'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { completeFreightBooking } from '@/app/actions/freight';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import type {
  ShipStationOrder,
  FreightBookingData,
  BookingStep,
  HazmatOverride,
  NmfcOverride,
  NmfcSuggestion,
  ManualClassificationInput,
  ValidationErrors,
  ClassifiedItem
} from '@/types/freight-booking';

export function useFreightBooking() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Core state
  const [currentStep, setCurrentStep] = useState<BookingStep>('selection');
  const [bookingData, setBookingData] = useState<FreightBookingData>({
    selectedOrder: null,
    carrierName: 'SAIA',
    serviceType: 'Standard LTL',
    estimatedCost: 0,
    specialInstructions: '',
    classifiedItems: [],
    hazmatAnalysis: null
  });
  
  // UI state
  const [availableOrders, setAvailableOrders] = useState<ShipStationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [workspaceLink, setWorkspaceLink] = useState<string>('');
  const [palletData, setPalletData] = useState<any[] | null>(null);
  
  // Per-SKU state
  const [hazmatBySku, setHazmatBySku] = useState<Record<string, HazmatOverride>>({});
  const [hazErrorsBySku, setHazErrorsBySku] = useState<Record<string, ValidationErrors>>({});
  const [nmfcBySku, setNmfcBySku] = useState<Record<string, NmfcOverride>>({});
  const [nmfcSuggestionBySku, setNmfcSuggestionBySku] = useState<Record<string, NmfcSuggestion>>({});
  const [manualInputs, setManualInputs] = useState<Record<string, ManualClassificationInput>>({});

  // Validation functions
  function isValidHazardClass(value: string): boolean {
    const allowed = new Set([
      '1','2','3','4','4.1','4.2','4.3','5.1','5.2','6.1','6.2','7','8','9'
    ]);
    return allowed.has((value || '').trim());
  }

  function validateHazmatFields(v: HazmatOverride): ValidationErrors {
    const errs: ValidationErrors = {};
    const isHaz = Boolean(v.isHazmat);
    const requireIfHaz = (cond: boolean) => isHaz && cond;

    const un = (v.unNumber || '').trim();
    if (requireIfHaz(true)) {
      if (!/^\d{3,4}$/.test(un)) {
        errs.unNumber = 'UN must be 3-4 digits when Hazmat';
      }
    } else if (un && !/^\d{3,4}$/.test(un)) {
      errs.unNumber = 'UN must be 3-4 digits';
    }

    const hc = (v.hazardClass || '').trim();
    if (requireIfHaz(true)) {
      if (!isValidHazardClass(hc)) {
        errs.hazardClass = 'Use a valid class (e.g., 3, 5.1, 8)';
      }
    } else if (hc && !isValidHazardClass(hc)) {
      errs.hazardClass = 'Invalid hazard class';
    }

    const pg = (v.packingGroup || '').trim().toUpperCase();
    if (pg && !['I','II','III'].includes(pg)) {
      errs.packingGroup = 'Packing Group must be I, II, or III';
    }

    const psn = (v.properShippingName || '').trim();
    if (requireIfHaz(true) && !psn) {
      errs.properShippingName = 'Proper Shipping Name is required when Hazmat';
    }

    return errs;
  }

  // Update functions
  function updateHazmatForSku(sku: string, patch: Partial<HazmatOverride>) {
    setHazmatBySku(prev => {
      const next = { ...(prev[sku] || {}), ...patch };
      const copy = { ...prev, [sku]: next };
      const errs = validateHazmatFields(next);
      setHazErrorsBySku(ePrev => ({ ...ePrev, [sku]: errs }));
      return copy;
    });
  }

  function updateNmfcForSku(sku: string, patch: Partial<NmfcOverride>) {
    setNmfcBySku(prev => ({ ...prev, [sku]: { ...(prev[sku] || {}), ...patch } }));
  }

  // API functions
  async function fetchAvailableOrders() {
    try {
      setLoading(true);
      const response = await fetch('/api/shipstation/orders?filter=awaiting_shipment');
      const data = await response.json();
      
      if (data.success && data.orders) {
        setAvailableOrders(data.orders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSpecificOrder(orderId: number) {
    try {
      const freightResponse = await fetch('/api/freight-orders/poll');
      const freightData = await freightResponse.json();
      
      if (freightData.success) {
        const allOrders = [...freightData.created, ...freightData.existing];
        const foundOrder = allOrders.find(order => order.orderId === orderId);
        
        if (foundOrder && foundOrder.shipstationData) {
          const shipstationOrder: ShipStationOrder = {
            orderId: foundOrder.orderId,
            orderNumber: foundOrder.orderNumber,
            customerEmail: foundOrder.shipstationData.customerEmail || '',
            customerName: foundOrder.shipstationData.billTo?.name || foundOrder.customerName || '',
            billTo: foundOrder.shipstationData.billTo || {
              name: foundOrder.customerName || '',
              company: '',
              street1: '',
              city: '',
              state: '',
              postalCode: ''
            },
            shipTo: foundOrder.shipstationData.shipTo || foundOrder.shipstationData.billTo || {
              name: foundOrder.customerName || '',
              company: '',
              street1: '',
              city: '',
              state: '',
              postalCode: ''
            },
            items: foundOrder.items?.map((item: any) => ({
              sku: item.sku || '',
              name: item.name,
              quantity: item.quantity,
              unitPrice: 0,
              weight: { value: 0, units: 'lbs' }
            })) || [],
            orderTotal: foundOrder.orderTotal || 0,
            shippingAmount: 0,
            orderDate: foundOrder.orderDate || new Date().toISOString(),
            orderStatus: 'awaiting_shipment'
          };
          
          handleOrderSelection(shipstationOrder);
          return;
        }
      }
      
      console.warn(`Could not find detailed order data for ID ${orderId}`);
    } catch (error) {
      console.error('Failed to fetch specific order:', error);
    }
  }

  async function suggestNmfcForSku(sku: string, isHaz: boolean, packingGroup?: string | null, unitWeightLbs?: number, qty?: number) {
    setNmfcSuggestionBySku(prev => ({ 
      ...prev, 
      [sku]: { label: 'Fetching suggestion...', loading: true } 
    }));
    
    const dims = nmfcBySku[sku] || {};
    
    try {
      const hazmatData = hazmatBySku[sku];
      const item = bookingData.selectedOrder?.items.find(i => i.sku === sku);
      
      const response = await fetch('/api/freight-booking/suggest-nmfc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          productName: item?.name,
          weight: unitWeightLbs,
          length: dims.lengthIn ? parseFloat(String(dims.lengthIn)) : null,
          width: dims.widthIn ? parseFloat(String(dims.widthIn)) : null,
          height: dims.heightIn ? parseFloat(String(dims.heightIn)) : null,
          quantity: qty || 1,
          isHazmat: isHaz,
          hazardClass: hazmatData?.hazardClass,
          packingGroup: packingGroup || hazmatData?.packingGroup,
          unNumber: hazmatData?.unNumber
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.suggestion) {
        const { suggestion } = result;
        
        if ((result.source === 'saved-classification' || result.productDimensions) && !dims.lengthIn) {
          if (result.productDimensions?.length) {
            updateNmfcForSku(sku, { 
              lengthIn: result.productDimensions.length,
              widthIn: result.productDimensions.width,
              heightIn: result.productDimensions.height
            });
          }
        }
        
        setNmfcSuggestionBySku(prev => ({ 
          ...prev, 
          [sku]: { 
            label: suggestion.label,
            nmfcCode: suggestion.nmfcCode,
            nmfcSub: suggestion.nmfcSub,
            freightClass: suggestion.freightClass,
            confidence: suggestion.confidence,
            source: result.source,
            loading: false
          } 
        }));
      } else {
        const errorMsg = result.missingFields?.forDensity?.length > 0 
          ? `Enter dimensions: ${result.missingFields.forDensity.join(', ')}`
          : result.message || 'No suggestion available';
          
        setNmfcSuggestionBySku(prev => ({ 
          ...prev, 
          [sku]: { 
            label: errorMsg,
            error: true,
            loading: false
          } 
        }));
      }
    } catch (error) {
      console.error('Failed to get NMFC suggestion:', error);
      setNmfcSuggestionBySku(prev => ({ 
        ...prev, 
        [sku]: { 
          label: 'Error getting suggestion',
          error: true,
          loading: false
        } 
      }));
    }
  }

  // Order handling
  async function handleOrderSelection(order: ShipStationOrder) {
    setBookingData(prev => ({ ...prev, selectedOrder: order }));
    
    // Fetch workspace pallet data if available
    try {
      const response = await fetch(`/api/workspace/${order.orderId}`);
      if (response.ok) {
        const workspace = await response.json();
        if (workspace.finalMeasurements?.pallets) {
          setPalletData(workspace.finalMeasurements.pallets);
        }
      }
    } catch (error) {
      console.error('Failed to fetch workspace pallet data:', error);
    }
    
    // Auto-classify products
    const classifiedItems: ClassifiedItem[] = [];
    for (const item of order.items) {
      try {
        const response = await fetch('/api/product-links/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku: item.sku })
        });
        const result = await response.json();
        
        classifiedItems.push({
          sku: item.sku,
          classification: result.hasClassification ? result.classification : null
        });
      } catch (error) {
        classifiedItems.push({ sku: item.sku, classification: null });
      }
    }
    
    setBookingData(prev => ({ ...prev, classifiedItems }));
    setCurrentStep('classification');
  }

  function handleClassificationComplete() {
    const hasHazmat = bookingData.classifiedItems.some(
      item => item.classification?.isHazmat
    );
    
    if (hasHazmat) {
      const initial: Record<string, HazmatOverride> = {};
      for (const it of bookingData.classifiedItems) {
        const c = it.classification;
        initial[it.sku] = {
          isHazmat: c?.isHazmat ?? false,
          unNumber: c?.unNumber || '',
          hazardClass: c?.hazmatClass || '',
          packingGroup: c?.packingGroup || '',
          properShippingName: c?.properShippingName || '',
          persist: false,
        };
      }
      setHazmatBySku(initial);
      setCurrentStep('hazmat-analysis');
    } else {
      setCurrentStep('confirmation');
    }
  }

  async function handleFinalBooking() {
    if (!bookingData.selectedOrder) return;
    
    setBooking(true);
    try {
      // Validate hazmat fields
      const anyInvalid = bookingData.selectedOrder.items.some(it => {
        const v = hazmatBySku[it.sku];
        const errs = validateHazmatFields(v || {});
        const hasErrs = Object.keys(errs).length > 0;
        const willPersist = Boolean(v?.persist);
        return willPersist && hasErrs;
      });
      
      if (anyInvalid) {
        toast({
          title: "Validation Error",
          description: "Please fix hazmat validation errors before booking.",
          variant: "destructive"
        });
        setBooking(false);
        return;
      }

      const result = await completeFreightBooking({
        orderId: String(bookingData.selectedOrder.orderId),
        orderNumber: bookingData.selectedOrder.orderNumber,
        carrierName: bookingData.carrierName,
        serviceType: bookingData.serviceType,
        estimatedCost: bookingData.estimatedCost,
        customerName: bookingData.selectedOrder.customerName,
        customerEmail: bookingData.selectedOrder.customerEmail,
        customerCompany: bookingData.selectedOrder.billTo?.company,
        originAddress: {
          address: bookingData.selectedOrder.shipTo?.street1,
          city: bookingData.selectedOrder.shipTo?.city,
          state: bookingData.selectedOrder.shipTo?.state,
          zipCode: bookingData.selectedOrder.shipTo?.postalCode
        },
        destinationAddress: {
          address: bookingData.selectedOrder.shipTo?.street1,
          city: bookingData.selectedOrder.shipTo?.city,
          state: bookingData.selectedOrder.shipTo?.state,
          zipCode: bookingData.selectedOrder.shipTo?.postalCode
        },
        packageDetails: {
          weight: { value: 0, units: 'lbs' },
          dimensions: { length: 0, width: 0, height: 0, units: 'in' },
          packageCount: bookingData.selectedOrder.items?.length || 1,
          description: 'Freight shipment'
        },
        palletData: palletData,
        specialInstructions: bookingData.specialInstructions
      });
      
      if (result.success) {
        setSuccess(true);
        setWorkspaceLink(result.workspaceLink || `/workspace/${bookingData.selectedOrder.orderId}`);
        toast({
          title: "Success!",
          description: "Freight booking completed successfully."
        });
      } else {
        toast({
          title: "Booking Failed",
          description: result.error || 'Please try again',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast({
        title: "Network Error",
        description: "Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setBooking(false);
    }
  }

  // Effects
  useEffect(() => {
    fetchAvailableOrders();
    
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdParam = urlParams.get('orderId');
    if (orderIdParam) {
      fetchSpecificOrder(parseInt(orderIdParam));
    }
  }, []);

  useEffect(() => {
    if (bookingData.classifiedItems?.length > 0 && currentStep === 'hazmat-analysis') {
      bookingData.classifiedItems.forEach(classifiedItem => {
        const item = bookingData.selectedOrder?.items.find(i => i.sku === classifiedItem.sku);
        if (item && !nmfcSuggestionBySku[item.sku]?.label) {
          const hazmatData = hazmatBySku[item.sku];
          suggestNmfcForSku(
            item.sku,
            Boolean(hazmatData?.isHazmat || classifiedItem.classification?.isHazmat),
            hazmatData?.packingGroup || classifiedItem.classification?.packingGroup,
            item.weight?.value,
            item.quantity
          );
        }
      });
    }
  }, [bookingData.classifiedItems, currentStep]);

  return {
    // State
    currentStep,
    setCurrentStep,
    bookingData,
    setBookingData,
    availableOrders,
    loading,
    booking,
    success,
    workspaceLink,
    palletData,
    
    // Per-SKU state
    hazmatBySku,
    hazErrorsBySku,
    nmfcBySku,
    nmfcSuggestionBySku,
    manualInputs,
    setManualInputs,
    
    // Functions
    fetchAvailableOrders,
    handleOrderSelection,
    handleClassificationComplete,
    handleFinalBooking,
    updateHazmatForSku,
    updateNmfcForSku,
    suggestNmfcForSku,
    
    // Utils
    warehouseFeedback,
    router,
    toast
  };
}
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TruckIcon, 
  CheckCircleIcon,
  ClockIcon,
  DocumentCheckIcon,
  BeakerIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';
import FreightNavigation from '@/components/navigation/FreightNavigation';
import { HazmatRAGPanel, type RAGSuggestion } from '@/components/freight-booking/HazmatRAGPanel';
import { warehouseFeedback, formatWarehouseText } from '@/lib/warehouse-ui-utils';
import HazmatCallout from '@/components/ui/HazmatCallout';
import WarehouseButton from '@/components/ui/WarehouseButton';
import ProgressBar from '@/components/ui/ProgressBar';
import StatusLight from '@/components/ui/StatusLight';

interface ShipStationOrder {
  orderId: number;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  billTo: {
    name: string;
    company: string;
    street1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  shipTo: {
    name: string;
    company: string;
    street1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    weight: { value: number; units: string };
  }>;
  orderTotal: number;
  shippingAmount: number;
  orderDate: string;
  orderStatus: string;
}

interface FreightBookingData {
  selectedOrder: ShipStationOrder | null;
  carrierName: string;
  serviceType: string;
  estimatedCost: number;
  specialInstructions: string;
  classifiedItems: Array<{
    sku: string;
    classification: {
      nmfcCode: string;
      freightClass: string;
      isHazmat: boolean;
      hazmatClass?: string;
      unNumber?: string;
      packingGroup?: string;
      properShippingName?: string;
    } | null;
  }>;
  hazmatAnalysis: any;
}

type BookingStep = 'selection' | 'classification' | 'hazmat-analysis' | 'confirmation';

export default function FreightBookingPage() {
  const router = useRouter();
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
  const [availableOrders, setAvailableOrders] = useState<ShipStationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [workspaceLink, setWorkspaceLink] = useState<string>('');
  // Per-SKU hazmat overrides captured in the UI
  const [hazmatBySku, setHazmatBySku] = useState<Record<string, {
    isHazmat?: boolean;
    unNumber?: string;
    hazardClass?: string;
    packingGroup?: string;
    properShippingName?: string;
    persist?: boolean;
  }>>({});
  const [hazErrorsBySku, setHazErrorsBySku] = useState<Record<string, {
    unNumber?: string;
    hazardClass?: string;
    packingGroup?: string;
    properShippingName?: string;
  }>>({});
  // Per-SKU NMFC overrides and suggestions
  const [nmfcBySku, setNmfcBySku] = useState<Record<string, {
    nmfcCode?: string;
    nmfcSub?: string;
    freightClass?: string;
    lengthIn?: number; // for density suggestion
    widthIn?: number;
    heightIn?: number;
  }>>({});
  const [nmfcSuggestionBySku, setNmfcSuggestionBySku] = useState<Record<string, {
    label: string; // e.g., rationale
    nmfcCode?: string;
    nmfcSub?: string;
    freightClass?: string;
    confidence?: number;
    source?: string;
    error?: boolean;
    loading?: boolean;
  }>>({});

  function isValidHazardClass(value: string): boolean {
    const allowed = new Set([
      '1','2','3','4','4.1','4.2','4.3','5.1','5.2','6.1','6.2','7','8','9'
    ]);
    return allowed.has((value || '').trim());
  }

  function validateHazmatFields(v: { isHazmat?: boolean; unNumber?: string; hazardClass?: string; packingGroup?: string; properShippingName?: string; persist?: boolean; }): { unNumber?: string; hazardClass?: string; packingGroup?: string; properShippingName?: string; } {
    const errs: any = {};
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

  function updateHazmatForSku(sku: string, patch: Partial<{ isHazmat: boolean; unNumber: string; hazardClass: string; packingGroup: string; properShippingName: string; persist: boolean; }>) {
    setHazmatBySku(prev => {
      const next = { ...(prev[sku] || {}), ...patch } as any;
      const copy = { ...prev, [sku]: next };
      // validate
      const errs = validateHazmatFields(next);
      setHazErrorsBySku(ePrev => ({ ...ePrev, [sku]: errs }));
      return copy;
    });
  }

  function updateNmfcForSku(sku: string, patch: Partial<{ nmfcCode: string; nmfcSub: string; freightClass: string; lengthIn: number; widthIn: number; heightIn: number }>) {
    setNmfcBySku(prev => ({ ...prev, [sku]: { ...(prev[sku] || {}), ...patch } }));
  }

  async function suggestNmfcForSku(sku: string, isHaz: boolean, packingGroup?: string | null, unitWeightLbs?: number, qty?: number) {
    // Show loading state
    setNmfcSuggestionBySku(prev => ({ 
      ...prev, 
      [sku]: { label: 'Fetching suggestion...', loading: true } 
    }));
    
    const dims = nmfcBySku[sku] || {};
    
    try {
      // Get hazmat data if available
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
        
        // Auto-populate dimensions if they came from database
        if ((result.source === 'saved-classification' || result.productDimensions) && !dims.lengthIn) {
          // Update dimension fields if empty
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
        // Show helpful error message
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

  const [manualInputs, setManualInputs] = useState<Record<string, {
    freightClass: string;
    nmfcCode: string;
    nmfcSub: string;
    description: string;
    saving?: boolean;
    error?: string | null;
    successMessage?: string;
    hazmatData?: {
      unNumber: string | null;
      hazardClass: string | null;
      packingGroup: string | null;
      properShippingName: string | null;
      isHazmat: boolean;
    };
  }>>({});

  useEffect(() => {
    fetchAvailableOrders();
    
    // Check if a specific order ID was passed in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdParam = urlParams.get('orderId');
    if (orderIdParam) {
      // Fetch the specific order and auto-select it
      fetchSpecificOrder(parseInt(orderIdParam));
    }
  }, []);

  // Auto-fetch product dimensions and suggestions when classified items change
  useEffect(() => {
    if (bookingData.classifiedItems?.length > 0 && currentStep === 'hazmat-analysis') {
      // Auto-trigger NMFC suggestions for all items
      bookingData.classifiedItems.forEach(classifiedItem => {
        const item = bookingData.selectedOrder?.items.find(i => i.sku === classifiedItem.sku);
        if (item && !nmfcSuggestionBySku[item.sku]?.label) {
          // Only fetch if we don't already have a suggestion
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

  const fetchAvailableOrders = async () => {
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
  };

  const fetchSpecificOrder = async (orderId: number) => {
    try {
      // First check freight orders to see if we can get the ShipStation data
      const freightResponse = await fetch('/api/freight-orders/poll');
      const freightData = await freightResponse.json();
      
      if (freightData.success) {
        const allOrders = [...freightData.created, ...freightData.existing];
        const foundOrder = allOrders.find(order => order.orderId === orderId);
        
        if (foundOrder && foundOrder.shipstationData) {
          // Convert freight order to ShipStation format
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
          
          // Auto-select this order
          handleOrderSelection(shipstationOrder);
          return;
        }
      }
      
      // Fallback: create a basic order structure from the orderId
      console.warn(`Could not find detailed order data for ID ${orderId}, creating basic structure`);
      const basicOrder: ShipStationOrder = {
        orderId: orderId,
        orderNumber: `ORDER-${orderId}`,
        customerEmail: '',
        customerName: 'Unknown Customer',
        billTo: {
          name: 'Unknown Customer',
          company: '',
          street1: '',
          city: '',
          state: '',
          postalCode: ''
        },
        shipTo: {
          name: 'Unknown Customer', 
          company: '',
          street1: '',
          city: '',
          state: '',
          postalCode: ''
        },
        items: [],
        orderTotal: 0,
        shippingAmount: 0,
        orderDate: new Date().toISOString(),
        orderStatus: 'awaiting_shipment'
      };
      
      handleOrderSelection(basicOrder);
    } catch (error) {
      console.error('Failed to fetch specific order:', error);
    }
  };

  const handleOrderSelection = async (order: ShipStationOrder) => {
    setBookingData(prev => ({ ...prev, selectedOrder: order }));
    
    // Auto-classify products
    const classifiedItems: Array<{
      sku: string;
      classification: {
        nmfcCode: string;
        freightClass: string;
        isHazmat: boolean;
        hazmatClass?: string;
        unNumber?: string;
        packingGroup?: string;
        properShippingName?: string;
      } | null;
    }> = [];
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
  };

  const handleClassificationComplete = () => {
    const hasHazmat = bookingData.classifiedItems.some(
      item => item.classification?.isHazmat
    );
    
    if (hasHazmat) {
      // Initialize per-SKU hazmat overrides from current classification
      const initial: Record<string, any> = {};
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
  };


  const handleFinalBooking = async () => {
    if (!bookingData.selectedOrder) return;
    
    setBooking(true);
    try {
      // Build userOverrides.hazmatBySku payload from state
      const hazBySkuPayload: Record<string, any> = {};
      for (const it of bookingData.selectedOrder.items) {
        const h = hazmatBySku[it.sku];
        if (!h) continue;
        hazBySkuPayload[it.sku] = {
          persist: Boolean(h.persist),
          // Only include fields that are set, so we don't stomp values unintentionally
          ...(typeof h.isHazmat === 'boolean' ? { isHazmat: h.isHazmat } : {}),
          ...(h.unNumber ? { unNumber: h.unNumber } : {}),
          ...(h.hazardClass ? { hazardClass: h.hazardClass } : {}),
          ...(h.packingGroup ? { packingGroup: h.packingGroup } : {}),
          ...(h.properShippingName ? { properShippingName: h.properShippingName } : {}),
        };
      }

      // Build userOverrides.nmfcBySku payload
      const nmfcBySkuPayload: Record<string, any> = {};
      for (const it of bookingData.selectedOrder.items) {
        const n = nmfcBySku[it.sku];
        if (!n) continue;
        const code = (n.nmfcCode || '').trim();
        const sub = (n.nmfcSub || '').trim();
        const freightClass = (n.freightClass || '').trim();
        if (code || sub || freightClass) {
          nmfcBySkuPayload[it.sku] = {
            ...(code ? { nmfcCode: code } : {}),
            ...(sub ? { nmfcSub: sub } : {}),
            ...(freightClass ? { freightClass } : {}),
          };
        }
      }

      // Prevent submit if there are validation errors for any persisted lines
      const anyInvalid = bookingData.selectedOrder.items.some(it => {
        const v = hazmatBySku[it.sku];
        const errs = validateHazmatFields(v || {});
        const hasErrs = Object.keys(errs).length > 0;
        const willPersist = Boolean(v?.persist);
        return willPersist && hasErrs;
      });
      if (anyInvalid) {
        alert('Fix hazmat validation errors before booking.');
        setBooking(false);
        return;
      }

      const response = await fetch('/api/freight-booking/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipstationOrder: bookingData.selectedOrder,
          carrierSelection: { carrier: bookingData.carrierName, service: bookingData.serviceType, mode: 'LTL' },
          userOverrides: { instructions: bookingData.specialInstructions, hazmatBySku: hazBySkuPayload, nmfcBySku: nmfcBySkuPayload },
          estimatedCost: bookingData.estimatedCost
        })
      });

      const result = await response.json();
      if (result.success) {
        setSuccess(true);
        setWorkspaceLink(result.workspaceLink || `/workspace/${bookingData.selectedOrder.orderId}`);
      } else {
        alert('Booking failed: ' + (result.error || 'Please try again'));
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Network error: Please try again');
    } finally {
      setBooking(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'selection': return 'Select Order to Ship';
      case 'classification': return 'Product Classification';
      case 'hazmat-analysis': return 'Hazmat Analysis';
      case 'confirmation': return 'Confirm Booking';
    }
  };

  const getStepIcon = () => {
    switch (currentStep) {
      case 'selection': return ClockIcon;
      case 'classification': return DocumentCheckIcon;
      case 'hazmat-analysis': return BeakerIcon;
      case 'confirmation': return TruckIcon;
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100">
        <FreightNavigation className="bg-white shadow-sm border-b px-6 py-4" />
        <div className="flex items-center justify-center py-16">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <CheckCircleIcon className="h-16 w-16 text-warehouse-go mx-auto mb-4" />
            <h1 className="text-warehouse-3xl font-black text-gray-900 mb-4 uppercase">Freight Booked!</h1>
            <p className="text-gray-600 mb-6">
              Order <strong>{bookingData.selectedOrder?.orderNumber}</strong> booked with {bookingData.carrierName}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  warehouseFeedback.complete();
                  router.push(workspaceLink);
                }}
                className="w-full bg-warehouse-go text-white py-8 px-6 rounded-warehouse text-warehouse-2xl font-black hover:bg-green-700 transition-colors shadow-warehouse border-b-8 border-green-800 active:scale-95"
                style={{ minHeight: '100px' }}
              >
                ✅ OPEN WORKSPACE
              </button>
              <button
                onClick={() => {
                  warehouseFeedback.buttonPress();
                  router.push('/');
                }}
                className="w-full bg-warehouse-neutral text-white py-8 px-6 rounded-warehouse text-warehouse-xl font-black hover:bg-gray-600 transition-colors shadow-warehouse border-b-8 border-gray-700 active:scale-95"
                style={{ minHeight: '100px' }}
              >
                ← DASHBOARD
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <FreightNavigation className="bg-white shadow-sm border-b px-6 py-4" />
      
      {/* Header with Progress */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {(() => {
                const Icon = getStepIcon();
                return <Icon className="h-8 w-8 text-blue-600 mr-3" />;
              })()}
              <div>
                <h1 className="text-warehouse-3xl font-black text-gray-900 uppercase">{getStepTitle()}</h1>
                <p className="text-sm text-gray-600">Professional freight booking workflow</p>
              </div>
            </div>
            
            {/* Progress Steps */}
            <div className="hidden md:flex items-center space-x-4">
              {[
                { key: 'selection', label: 'Select', icon: ClockIcon },
                { key: 'classification', label: 'Classify', icon: DocumentCheckIcon },
                { key: 'hazmat-analysis', label: 'Hazmat', icon: BeakerIcon },
                { key: 'confirmation', label: 'Confirm', icon: TruckIcon }
              ].map((step, index) => {
                const isActive = currentStep === step.key;
                const isCompleted = ['selection', 'classification', 'hazmat-analysis', 'confirmation'].indexOf(currentStep) > index;
                const StepIcon = step.icon;
                
                return (
                  <div key={step.key} className="flex items-center">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isActive ? 'border-blue-600 bg-blue-600 text-white' :
                      isCompleted ? 'border-green-600 bg-green-600 text-white' :
                      'border-gray-300 bg-white text-gray-400'
                    }`}>
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <span className={`ml-2 text-sm font-medium ${
                      isActive ? 'text-blue-600' :
                      isCompleted ? 'text-green-600' :
                      'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                    {index < 3 && (
                      <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-4" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Step 1: Order Selection */}
        {currentStep === 'selection' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-warehouse-2xl font-black text-gray-900 uppercase mb-2">📦 Awaiting Shipment</h2>
              <p className="text-gray-600">Select an order from ShipStation to book freight shipping</p>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading orders from ShipStation...</p>
              </div>
            ) : availableOrders.length === 0 ? (
              <div className="text-center py-12">
                <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-gray-600">No orders awaiting shipment found</p>
                <button
                  onClick={() => {
                    warehouseFeedback.buttonPress();
                    fetchAvailableOrders();
                  }}
                  className="mt-4 px-8 py-6 bg-warehouse-info text-white rounded-warehouse text-warehouse-xl font-black hover:bg-blue-700 transition-colors shadow-warehouse border-b-4 border-blue-800"
                  style={{ minHeight: '80px' }}
                >
                  🔄 REFRESH ORDERS
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {availableOrders.map((order) => (
                  <button
                    key={order.orderId}
                    className="w-full text-left border-2 border-gray-300 rounded-warehouse p-6 hover:border-warehouse-info hover:bg-blue-50 cursor-pointer transition-all active:scale-95 shadow-warehouse"
                    onClick={() => {
                      warehouseFeedback.buttonPress();
                      handleOrderSelection(order);
                    }}
                    style={{ minHeight: '100px' }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-warehouse-xl font-black text-gray-900 uppercase">
                          {order.orderNumber}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {order.billTo?.company || order.billTo?.name || 'Customer'} → {order.shipTo?.company || order.shipTo?.name || 'Destination'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {order.items.length} items • ${order.orderTotal}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          {order.orderStatus}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{order.orderDate}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center text-warehouse-xl font-black text-warehouse-info uppercase">
                      <TruckIcon className="h-6 w-6 mr-2" />
                      {formatWarehouseText('Tap to book freight', 'action')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Product Classification */}
        {currentStep === 'classification' && bookingData.selectedOrder && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-warehouse-2xl font-black text-gray-900 uppercase mb-4">⚡ Classification Status</h2>
              
              <div className="grid gap-4">
                {bookingData.selectedOrder.items.map((item) => {
                  const classification = bookingData.classifiedItems.find(c => c.sku === item.sku);
                  const hasClassification = classification?.classification;
                  
                  return (
                    <div key={item.sku} className="border-2 border-gray-300 rounded-warehouse p-6 shadow-warehouse">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <h3 className="text-warehouse-xl font-black text-gray-900 uppercase">{item.name}</h3>
                          <p className="text-warehouse-lg text-gray-600 mt-1">
                            SKU: <span className="font-mono font-bold">{item.sku}</span> • 
                            QTY: <span className="font-black">{item.quantity}</span>
                          </p>
                        </div>
                        <div className="ml-4">
                          {hasClassification ? (
                            <div className="text-center">
                              <div className="inline-flex items-center px-6 py-3 rounded-warehouse text-warehouse-lg font-black bg-warehouse-go text-white shadow-warehouse">
                                ✅ CLASSIFIED
                              </div>
                              <p className="text-warehouse-lg font-bold text-gray-700 mt-2">
                                CLASS {classification.classification?.freightClass}
                              </p>
                              {classification.classification?.isHazmat && (
                                <div className="mt-2">
                                  <StatusLight status="caution" size="base" label="HAZMAT" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 w-[380px]">
                              <div className="font-bold text-gray-800 mb-2">
                                Manual Classification
                                {manualInputs[item.sku]?.hazmatData?.isHazmat && (
                                  <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                    ⚠️ HAZMAT DATA LOADED
                                  </span>
                                )}
                              </div>
                              {/* Display hazmat data if present */}
                              {manualInputs[item.sku]?.hazmatData && manualInputs[item.sku]?.hazmatData?.unNumber && (
                                <HazmatCallout
                                  level="warning"
                                  unNumber={manualInputs[item.sku]?.hazmatData?.unNumber}
                                  hazardClass={manualInputs[item.sku]?.hazmatData?.hazardClass}
                                  packingGroup={manualInputs[item.sku]?.hazmatData?.packingGroup}
                                  properShippingName={manualInputs[item.sku]?.hazmatData?.properShippingName}
                                  className="mb-3"
                                >
                                  This product requires special handling and documentation
                                </HazmatCallout>
                              )}
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Freight Class</label>
                                  <input
                                    type="text"
                                    value={manualInputs[item.sku]?.freightClass ?? ''}
                                    onChange={(e) => setManualInputs(prev => ({
                                      ...prev,
                                      [item.sku]: {
                                        ...prev[item.sku],
                                        freightClass: e.target.value,
                                        nmfcCode: prev[item.sku]?.nmfcCode ?? '',
                                        nmfcSub: prev[item.sku]?.nmfcSub ?? '',
                                        description: prev[item.sku]?.description ?? '',
                                      }
                                    }))}
                                    placeholder="e.g. 85"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">NMFC Code</label>
                                  <input
                                    type="text"
                                    value={manualInputs[item.sku]?.nmfcCode ?? ''}
                                    onChange={(e) => setManualInputs(prev => ({
                                      ...prev,
                                      [item.sku]: {
                                        ...prev[item.sku],
                                        freightClass: prev[item.sku]?.freightClass ?? '',
                                        nmfcCode: e.target.value,
                                        nmfcSub: prev[item.sku]?.nmfcSub ?? '',
                                        description: prev[item.sku]?.description ?? '',
                                      }
                                    }))}
                                    placeholder="e.g. 12345"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">NMFC Sub</label>
                                  <input
                                    type="text"
                                    value={manualInputs[item.sku]?.nmfcSub ?? ''}
                                    onChange={(e) => setManualInputs(prev => ({
                                      ...prev,
                                      [item.sku]: {
                                        ...prev[item.sku],
                                        freightClass: prev[item.sku]?.freightClass ?? '',
                                        nmfcCode: prev[item.sku]?.nmfcCode ?? '',
                                        nmfcSub: e.target.value,
                                        description: prev[item.sku]?.description ?? '',
                                      }
                                    }))}
                                    placeholder="e.g. 03"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Description</label>
                                  <input
                                    type="text"
                                    value={manualInputs[item.sku]?.description ?? ''}
                                    onChange={(e) => setManualInputs(prev => ({
                                      ...prev,
                                      [item.sku]: {
                                        ...prev[item.sku],
                                        freightClass: prev[item.sku]?.freightClass ?? '',
                                        nmfcCode: prev[item.sku]?.nmfcCode ?? '',
                                        nmfcSub: prev[item.sku]?.nmfcSub ?? '',
                                        description: e.target.value,
                                      }
                                    }))}
                                    placeholder="Proper shipping name"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                              </div>
                              {manualInputs[item.sku]?.successMessage && (
                                <div className="text-green-600 text-xs mb-2 font-bold animate-pulse">
                                  {manualInputs[item.sku]?.successMessage}
                                </div>
                              )}
                              {manualInputs[item.sku]?.error && (
                                <div className="text-red-600 text-xs mb-2">{manualInputs[item.sku]?.error}</div>
                              )}
                              <button
                                onClick={async () => {
                                  const inputs = manualInputs[item.sku] || { freightClass: '', nmfcCode: '', nmfcSub: '', description: '' };
                                  if (!inputs.freightClass) {
                                    setManualInputs(prev => ({ ...prev, [item.sku]: { ...inputs, error: 'Freight class is required' } }));
                                    warehouseFeedback.warning();
                                    return;
                                  }
                                  try {
                                    setManualInputs(prev => ({ ...prev, [item.sku]: { ...inputs, saving: true, error: null } }));
                                    const res = await fetch('/api/products/freight-link', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        sku: item.sku,
                                        freightClass: inputs.freightClass,
                                        nmfcCode: inputs.nmfcCode || undefined,
                                        nmfcSub: inputs.nmfcSub || undefined,
                                        description: inputs.description || undefined,
                                        approve: true,
                                        // Include hazmat data if available
                                        hazmatData: inputs.hazmatData || undefined,
                                      })
                                    });
                                    const data = await res.json();
                                    if (!res.ok || !data.success) {
                                      throw new Error(data.error || 'Failed to save classification');
                                    }
                                    // Update local state so this item is now classified with full hazmat data
                                    setBookingData(prev => ({
                                      ...prev,
                                      classifiedItems: prev.classifiedItems.map(ci =>
                                        ci.sku === item.sku ? {
                                          ...ci,
                                          classification: {
                                            nmfcCode: data.classification.nmfcCode,
                                            freightClass: data.classification.freightClass,
                                            isHazmat: data.classification.isHazmat || inputs.hazmatData?.isHazmat || false,
                                            // Include full hazmat details from API response
                                            hazmatClass: data.classification.hazmatClass || inputs.hazmatData?.hazardClass,
                                            unNumber: data.product?.unNumber || inputs.hazmatData?.unNumber,
                                            packingGroup: data.classification.packingGroup || inputs.hazmatData?.packingGroup,
                                            properShippingName: data.classification.description || inputs.hazmatData?.properShippingName,
                                          }
                                        } : ci
                                      )
                                    }));
                                    warehouseFeedback.success();
                                  } catch (err: any) {
                                    setManualInputs(prev => ({ ...prev, [item.sku]: { ...inputs, saving: false, error: err?.message || 'Save failed' } }));
                                    warehouseFeedback.error();
                                    return;
                                  } finally {
                                    setManualInputs(prev => ({ ...prev, [item.sku]: { ...prev[item.sku], saving: false } }));
                                  }
                                }}
                                disabled={manualInputs[item.sku]?.saving}
                                className="w-full px-4 py-3 bg-warehouse-caution text-white rounded-warehouse text-warehouse-lg font-black hover:bg-amber-600 transition-colors shadow-warehouse border-b-4 border-amber-700 active:scale-95"
                              >
                                {manualInputs[item.sku]?.saving ? 'SAVING…' : 'SAVE & LINK'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* RAG Panel for Auto-Classification */}
              {bookingData.classifiedItems.some(item => !item.classification) && (
                <HazmatRAGPanel
                  unclassifiedSKUs={bookingData.classifiedItems
                    .filter(item => !item.classification)
                    .map(item => item.sku)
                  }
                  items={bookingData.selectedOrder.items}
                  onSuggestionAccepted={async (sku: string, suggestion: RAGSuggestion) => {
                    // Auto-populate the manual classification form with hazmat data
                    const hazmatClass = suggestion.hazard_class;
                    const description = suggestion.proper_shipping_name || 
                                       bookingData.selectedOrder?.items.find(i => i.sku === sku)?.name || 
                                       'Chemical Product';
                    
                    // Get the item details for density calculation (non-hazmat only)
                    const item = bookingData.selectedOrder?.items.find(i => i.sku === sku);
                    
                    // Query REAL classifications from database
                    let nmfcCode = '';
                    let nmfcSub = '';
                    let freightClass = hazmatClass ? '85' : '50'; // Defaults only if search fails
                    
                    try {
                      const searchResponse = await fetch('/api/freight-classifications/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          sku: sku,
                          productName: description,
                          unNumber: suggestion.un_number,
                          hazardClass: hazmatClass,
                          packingGroup: suggestion.packing_group,
                          isHazmat: !!suggestion.un_number,
                          description: description,
                          // Include weight/dimensions if available (for non-hazmat density calc)
                          weight: item?.weight?.value,
                          quantity: item?.quantity
                        })
                      });
                      
                      const searchResult = await searchResponse.json();
                      
                      if (searchResult.success && searchResult.bestMatch) {
                        // Use REAL classification data from database!
                        const match = searchResult.bestMatch;
                        nmfcCode = match.nmfcCode || '';
                        nmfcSub = match.nmfcSub || '';
                        freightClass = match.freightClass;
                        
                        console.log(`Found REAL classification for ${sku}:`, {
                          nmfc: `${nmfcCode}${nmfcSub ? '-' + nmfcSub : ''}`,
                          class: freightClass,
                          reason: match.matchReason,
                          confidence: match.confidence
                        });
                      } else {
                        console.warn(`No classification found for ${sku}, using defaults`);
                      }
                    } catch (error) {
                      console.error('Failed to search classifications:', error);
                      // Keep default values if search fails
                    }
                    
                    // Prepare classification data with REAL NMFC codes
                    const classificationData = {
                      freightClass: freightClass,
                      nmfcCode: nmfcCode,
                      nmfcSub: nmfcSub,
                      description: description,
                      hazmatData: {
                        unNumber: suggestion.un_number,
                        hazardClass: suggestion.hazard_class,
                        packingGroup: suggestion.packing_group,
                        properShippingName: suggestion.proper_shipping_name,
                        isHazmat: !!suggestion.un_number
                      }
                    };
                    
                    // Auto-populate the manual form first
                    setManualInputs(prev => ({
                      ...prev,
                      [sku]: {
                        ...classificationData,
                        saving: true,
                        successMessage: '⏳ Applying classification...'
                      }
                    }));
                    
                    // Auto-save the classification
                    try {
                      const res = await fetch('/api/products/freight-link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          sku: sku,
                          freightClass: freightClass,
                          nmfcCode: nmfcCode || undefined,
                          nmfcSub: nmfcSub || undefined,  // Now includes REAL sub-code from database!
                          description: description || undefined,
                          approve: true,
                          hazmatData: classificationData.hazmatData
                        })
                      });
                      
                      const data = await res.json();
                      if (!res.ok || !data.success) {
                        throw new Error(data.error || 'Failed to save classification');
                      }
                      
                      // Update local state so this item is now classified
                      setBookingData(prev => ({
                        ...prev,
                        classifiedItems: prev.classifiedItems.map(ci =>
                          ci.sku === sku ? {
                            ...ci,
                            classification: {
                              nmfcCode: data.classification.nmfcCode,
                              nmfcSub: data.classification.nmfcSub,
                              freightClass: data.classification.freightClass,
                              description: data.classification.description,
                              isHazmat: data.classification.isHazmat || classificationData.hazmatData?.isHazmat || false,
                              hazmatClass: data.classification.hazmatClass || classificationData.hazmatData?.hazardClass,
                              unNumber: data.product?.unNumber || classificationData.hazmatData?.unNumber,
                              packingGroup: data.classification.packingGroup || classificationData.hazmatData?.packingGroup,
                              properShippingName: data.classification.description || classificationData.hazmatData?.properShippingName,
                            }
                          } : ci
                        )
                      }));
                      
                      // Show success feedback
                      warehouseFeedback.success();
                      setManualInputs(prev => ({
                        ...prev,
                        [sku]: {
                          ...prev[sku],
                          saving: false,
                          successMessage: '✅ Classification applied and saved!'
                        }
                      }));
                      
                      // Clear success message after 3 seconds
                      setTimeout(() => {
                        setManualInputs(prev => ({
                          ...prev,
                          [sku]: {
                            ...prev[sku],
                            successMessage: undefined
                          }
                        }));
                      }, 3000);
                      
                    } catch (err: any) {
                      // On error, keep the form populated but show error
                      setManualInputs(prev => ({
                        ...prev,
                        [sku]: {
                          ...prev[sku],
                          saving: false,
                          error: err?.message || 'Failed to save classification',
                          successMessage: undefined
                        }
                      }));
                      warehouseFeedback.error();
                    }
                    
                    console.log('Applied hazmat classification for SKU:', sku, suggestion);
                  }}
                />
              )}
              
              <div className="mt-6 flex justify-between gap-4">
                <button
                  onClick={() => {
                    warehouseFeedback.buttonPress();
                    setCurrentStep('selection');
                  }}
                  className="flex-1 px-8 py-6 bg-warehouse-neutral text-white rounded-warehouse text-warehouse-xl font-black hover:bg-gray-600 transition-colors shadow-warehouse border-b-4 border-gray-700 active:scale-95"
                  style={{ minHeight: '80px' }}
                >
                  ← BACK
                </button>
                <button
                  onClick={() => {
                    if (!bookingData.classifiedItems.some(item => !item.classification)) {
                      warehouseFeedback.success();
                      handleClassificationComplete();
                    } else {
                      warehouseFeedback.warning();
                    }
                  }}
                  disabled={bookingData.classifiedItems.some(item => !item.classification)}
                  className="flex-1 px-8 py-6 bg-warehouse-go text-white rounded-warehouse text-warehouse-xl font-black hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-warehouse border-b-4 border-green-800 disabled:border-gray-500 active:scale-95"
                  style={{ minHeight: '80px' }}
                >
                  CONTINUE →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Hazmat Analysis */}
        {currentStep === 'hazmat-analysis' && bookingData.selectedOrder && (
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            {/* Per-line Hazmat Overrides */}
            <div>
              <h3 className="text-warehouse-xl font-black text-gray-900 uppercase mb-3">Per-SKU Hazmat & NMFC</h3>
              <div className="space-y-4">
                {bookingData.selectedOrder.items.map((item) => {
                  const v = hazmatBySku[item.sku] || {};
                  const err = hazErrorsBySku[item.sku] || {};
                  const n = nmfcBySku[item.sku] || {};
                  const suggest = nmfcSuggestionBySku[item.sku];
                  return (
                    <div key={item.sku} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-600">SKU: <span className="font-mono">{item.sku}</span></div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={Boolean(v.persist)}
                            onChange={(e) => updateHazmatForSku(item.sku, { persist: e.target.checked })}
                          />
                          <span>Save as override</span>
                        </label>
                      </div>

                      <div className="grid md:grid-cols-5 gap-3">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={Boolean(v.isHazmat)}
                            onChange={(e) => updateHazmatForSku(item.sku, { isHazmat: e.target.checked })}
                          />
                          Hazmat
                        </label>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">UN Number</div>
                          <input
                            type="text"
                            value={v.unNumber ?? ''}
                            onChange={(e) => updateHazmatForSku(item.sku, { unNumber: e.target.value })}
                            placeholder="e.g. 1993"
                            className={`w-full p-2 border rounded-md ${err.unNumber ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {err.unNumber && <div className="text-xs text-red-600 mt-1">{err.unNumber}</div>}
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Hazard Class</div>
                          <input
                            type="text"
                            value={v.hazardClass ?? ''}
                            onChange={(e) => updateHazmatForSku(item.sku, { hazardClass: e.target.value })}
                            placeholder="e.g. 3"
                            className={`w-full p-2 border rounded-md ${err.hazardClass ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {err.hazardClass && <div className="text-xs text-red-600 mt-1">{err.hazardClass}</div>}
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Packing Group</div>
                          <input
                            type="text"
                            value={v.packingGroup ?? ''}
                            onChange={(e) => updateHazmatForSku(item.sku, { packingGroup: e.target.value })}
                            placeholder="I / II / III"
                            className={`w-full p-2 border rounded-md ${err.packingGroup ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {err.packingGroup && <div className="text-xs text-red-600 mt-1">{err.packingGroup}</div>}
                        </div>
                        <div className="md:col-span-5">
                          <div className="text-xs text-gray-600 mb-1">Proper Shipping Name</div>
                          <input
                            type="text"
                            value={v.properShippingName ?? ''}
                            onChange={(e) => updateHazmatForSku(item.sku, { properShippingName: e.target.value })}
                            placeholder="e.g. Flammable liquids, n.o.s."
                            className={`w-full p-2 border rounded-md ${err.properShippingName ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {err.properShippingName && <div className="text-xs text-red-600 mt-1">{err.properShippingName}</div>}
                        </div>
                      </div>

                      {/* NMFC inputs and density/PG suggestions */}
                      <div className="mt-4 border-t pt-4">
                        <div className="grid md:grid-cols-5 gap-3 items-end">
                          <div>
                            <div className="text-xs text-gray-600 mb-1">NMFC Code</div>
                            <input
                              type="text"
                              value={n.nmfcCode || ''}
                              onChange={(e) => {
                                updateNmfcForSku(item.sku, { nmfcCode: e.target.value });
                                suggestNmfcForSku(item.sku, Boolean(v.isHazmat), v.packingGroup, item.weight?.value, item.quantity);
                              }}
                              placeholder="e.g. 43940"
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">NMFC Sub</div>
                            <input
                              type="text"
                              value={n.nmfcSub || ''}
                              onChange={(e) => updateNmfcForSku(item.sku, { nmfcSub: e.target.value })}
                              placeholder="e.g. 3"
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Freight Class</div>
                            <input
                              type="text"
                              value={n.freightClass || ''}
                              onChange={(e) => updateNmfcForSku(item.sku, { freightClass: e.target.value })}
                              placeholder="e.g. 70"
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          {/* Dimensions for density suggestion (non-haz) */}
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Length (in)</div>
                            <input
                              type="number"
                              value={n.lengthIn || ''}
                              onChange={(e) => updateNmfcForSku(item.sku, { lengthIn: Number(e.target.value) })}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Width (in)</div>
                            <input
                              type="number"
                              value={n.widthIn || ''}
                              onChange={(e) => updateNmfcForSku(item.sku, { widthIn: Number(e.target.value) })}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Height (in)</div>
                            <input
                              type="number"
                              value={n.heightIn || ''}
                              onChange={(e) => updateNmfcForSku(item.sku, { heightIn: Number(e.target.value) })}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div className="md:col-span-5 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => suggestNmfcForSku(item.sku, Boolean(v.isHazmat), v.packingGroup, item.weight?.value, item.quantity)}
                              className="px-4 py-2 bg-gray-200 rounded-md text-sm font-medium hover:bg-gray-300"
                            >
                              Suggest NMFC
                            </button>
                            {suggest?.label && (
                              <div className="flex items-center gap-3">
                                <span className={`text-sm ${suggest.error ? 'text-red-600' : suggest.loading ? 'text-blue-600' : 'text-gray-700'}`}>
                                  {suggest.label}
                                </span>
                                {suggest.confidence && !suggest.error && !suggest.loading && (
                                  <span className="text-xs text-gray-500">
                                    {(suggest.confidence * 100).toFixed(0)}% confidence
                                  </span>
                                )}
                                {suggest.source && !suggest.error && !suggest.loading && (
                                  <span className="text-xs text-blue-600">
                                    ({suggest.source.replace('-', ' ')})
                                  </span>
                                )}
                                {!suggest.error && !suggest.loading && suggest.nmfcCode && (
                                  <button
                                    type="button"
                                    onClick={() => updateNmfcForSku(item.sku, { 
                                      nmfcCode: suggest.nmfcCode, 
                                      nmfcSub: suggest.nmfcSub, 
                                      freightClass: suggest.freightClass 
                                    })}
                                    className="px-3 py-1 bg-warehouse-go text-white rounded-md text-xs font-bold hover:bg-green-700"
                                  >
                                    Apply
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hazmat analysis completed - ready for booking through TMS API */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-green-800 font-medium">Ready for freight booking</span>
              </div>
              <p className="text-green-700 text-sm mt-1">
                All items classified. Use your TMS system to book freight with appropriate carriers.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 'confirmation' && bookingData.selectedOrder && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-warehouse-2xl font-black text-gray-900 uppercase mb-6">🎯 Confirm Booking</h2>
            
            {/* Order Summary */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Order Details</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Order:</span> {bookingData.selectedOrder.orderNumber}</p>
                  <p><span className="font-medium">Customer:</span> {bookingData.selectedOrder.billTo.company || bookingData.selectedOrder.billTo.name}</p>
                  <p><span className="font-medium">Items:</span> {bookingData.selectedOrder.items.length}</p>
                  <p><span className="font-medium">Value:</span> ${bookingData.selectedOrder.orderTotal}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Freight Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                    <select
                      value={bookingData.carrierName}
                      onChange={(e) => setBookingData(prev => ({ ...prev, carrierName: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="SAIA">SAIA</option>
                      <option value="XPO">XPO Logistics</option>
                      <option value="FedEx Freight">FedEx Freight</option>
                      <option value="YRC">YRC Freight</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                    <select
                      value={bookingData.serviceType}
                      onChange={(e) => setBookingData(prev => ({ ...prev, serviceType: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Standard LTL">Standard LTL</option>
                      <option value="Expedited">Expedited</option>
                      <option value="Volume LTL">Volume LTL</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost ($)</label>
                    <input
                      type="number"
                      value={bookingData.estimatedCost}
                      onChange={(e) => setBookingData(prev => ({ ...prev, estimatedCost: Number(e.target.value) }))}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter estimated cost"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Special Instructions */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
              <textarea
                value={bookingData.specialInstructions}
                onChange={(e) => setBookingData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                placeholder="Any special handling requirements..."
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
            
            {/* Classification Summary */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Classification Summary</h3>
              <div className="grid gap-3">
                {bookingData.classifiedItems.map((item) => {
                  const orderItem = bookingData.selectedOrder!.items.find(i => i.sku === item.sku);
                  return (
                    <div key={item.sku} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{orderItem?.name}</span>
                        <span className="text-sm text-gray-500 ml-2">({item.sku})</span>
                      </div>
                      <div className="text-sm">
                        {item.classification ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.classification.isHazmat 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            Class {item.classification.freightClass}
                            {item.classification.isHazmat && ' • HAZMAT'}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Unclassified
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-between gap-4">
              <button
                onClick={() => {
                  warehouseFeedback.buttonPress();
                  setCurrentStep('classification');
                }}
                className="flex-1 px-8 py-6 bg-warehouse-neutral text-white rounded-warehouse text-warehouse-xl font-black hover:bg-gray-600 transition-colors shadow-warehouse border-b-4 border-gray-700 active:scale-95"
                style={{ minHeight: '80px' }}
              >
                ← BACK
              </button>
              
              <button
                onClick={() => {
                  if (!booking && bookingData.estimatedCost > 0) {
                    warehouseFeedback.buttonPress();
                    handleFinalBooking();
                  } else if (bookingData.estimatedCost === 0) {
                    warehouseFeedback.warning();
                  }
                }}
                disabled={booking || bookingData.estimatedCost === 0}
                className="flex-1 bg-warehouse-go text-white py-6 px-8 rounded-warehouse text-warehouse-2xl font-black hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-warehouse border-b-8 border-green-800 disabled:border-gray-500 active:scale-95"
                style={{ minHeight: '100px' }}
              >
                {booking ? '🚛 BOOKING...' : '🚛 BOOK FREIGHT'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

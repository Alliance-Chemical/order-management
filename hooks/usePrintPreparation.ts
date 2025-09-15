'use client';

import { useState, useEffect, useRef } from 'react';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import { filterOutDiscounts } from '@/lib/services/orders/normalize';
import { getQRCodesForWorkspace, regenerateQRCodes, printQR } from '@/app/actions/qr';

interface FreightOrder {
  orderId: number;
  orderNumber: string;
  customerName?: string;
  items?: any[];
}

interface QRCode {
  id: string;
  code: string;
  shortCode?: string;
  qrType?: string;
  encodedData?: any;
  metadata?: any;
}

interface UsePrintPreparationProps {
  order: FreightOrder;
  onPrintComplete: () => void;
}

export function usePrintPreparation({ order, onPrintComplete }: UsePrintPreparationProps) {
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  
  // Store regenerated QR codes in ref to avoid async setState issues
  const regeneratedQRsRef = useRef<Record<string, QRCode[]>>({});

  useEffect(() => {
    fetchQRCodes();
  }, [order.orderId]);

  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      const result = await getQRCodesForWorkspace(order.orderId.toString());
      if (result.success && result.qrCodes) {
        setQrCodes(result.qrCodes);
        
        // Initialize quantities based on existing QR codes
        const quantities: Record<string, number> = {};
        const filteredItems = filterOutDiscounts(order.items || []);
        
        filteredItems.forEach(item => {
          const itemQRs = result.qrCodes.filter((qr: QRCode) => 
            qr.encodedData?.itemName === item.name || 
            qr.metadata?.itemName === item.name
          );
          quantities[item.name] = itemQRs.length || 1;
        });
        
        setLabelQuantities(quantities);
      }
    } catch (error) {
      console.error('Failed to fetch QR codes:', error);
      warehouseFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = async (itemName: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setLabelQuantities(prev => ({ ...prev, [itemName]: newQuantity }));
    
    // Regenerate QR codes if quantity changed
    const currentQRs = qrCodes.filter(qr => 
      qr.encodedData?.itemName === itemName || 
      qr.metadata?.itemName === itemName
    );
    
    if (currentQRs.length !== newQuantity) {
      await regenerateQRsForItem(itemName, newQuantity);
    }
  };

  const regenerateQRsForItem = async (itemName: string, quantity: number) => {
    setRegenerating(prev => ({ ...prev, [itemName]: true }));
    
    try {
      const item = order.items?.find(i => i.name === itemName);
      if (!item) return;
      
      // Create items array for server action
      const items = [{
        ...item,
        labelCount: quantity
      }];
      
      const result = await regenerateQRCodes(order.orderId.toString(), items);
      
      if (result.success && result.qrCodes) {
        // Store in ref first to avoid async issues
        regeneratedQRsRef.current[itemName] = result.qrCodes;
        
        // Update state with new QR codes
        setQrCodes(prev => {
          // Remove old QRs for this item
          const filtered = prev.filter(qr => 
            qr.encodedData?.itemName !== itemName && 
            qr.metadata?.itemName !== itemName
          );
          // Add new QRs from ref
          return [...filtered, ...(regeneratedQRsRef.current[itemName] || [])];
        });
        
        warehouseFeedback.success();
      }
    } catch (error) {
      console.error('Failed to regenerate QR codes:', error);
      warehouseFeedback.error();
    } finally {
      setRegenerating(prev => ({ ...prev, [itemName]: false }));
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    warehouseFeedback.buttonPress();

    try {
      // Filter out any QR codes that are missing shortCode
      const validQRs = qrCodes.filter(qr => qr.shortCode);

      if (validQRs.length === 0) {
        throw new Error('No valid QR codes found. Please regenerate QR codes first.');
      }

      console.log('[PRINT HOOK] Sending QR codes for printing:', validQRs.map(qr => ({
        id: qr.id,
        shortCode: qr.shortCode,
        qrType: qr.qrType
      })));

      // Call actual print API
      const response = await fetch(`/api/qr/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf' },
        body: JSON.stringify({
          orderId: order.orderId,
          qrCodes: validQRs.map(qr => ({
            id: qr.id,
            code: qr.code,
            shortCode: qr.shortCode
          })),
          // Defaults used by API: labelSize '4x6', fulfillmentMethod 'standard'
          // Explicitly pass to be clear and future-proof
          labelSize: '4x6',
          fulfillmentMethod: 'standard'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[PRINT HOOK] Print API error response:', errorData);
        throw new Error(errorData.error || `Print failed with status ${response.status}`);
      }

      // Consume the PDF response and open/download it
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Received empty PDF from server');
      }

      const blobUrl = window.URL.createObjectURL(blob);
      // Try to open in a new tab first
      const newTab = window.open(blobUrl, '_blank');

      if (newTab) {
        // Give the browser a moment to load before revoking
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 10000);
      } else {
        // Popup blocked; fall back to auto-download
        const a = document.createElement('a');
        a.href = blobUrl;
        // Try to respect filename from header; fallback to order number
        const cd = response.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename\*=UTF-8''([^;\n]+)/) || cd.match(/filename="?([^";\n]+)"?/);
        const filename = match && match[1] ? decodeURIComponent(match[1]) : `labels-${order.orderNumber}.pdf`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 5000);
      }

      warehouseFeedback.complete();
      onPrintComplete();
    } catch (error) {
      console.error('Print failed:', error);
      warehouseFeedback.error();
    } finally {
      setPrinting(false);
    }
  };

  const filteredItems = filterOutDiscounts(order.items || []);
  
  const totalLabels = Object.values(labelQuantities).reduce((sum, qty) => sum + qty, 0) || qrCodes.length;

  return {
    qrCodes,
    loading,
    printing,
    labelQuantities,
    regenerating,
    filteredItems,
    totalLabels,
    handleQuantityChange,
    handlePrint
  };
}

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
      // Call actual print API
      const response = await fetch(`/api/qr/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderId,
          qrCodes: qrCodes.map(qr => ({
            id: qr.id,
            code: qr.code,
            shortCode: qr.shortCode
          }))
        })
      });
      
      if (!response.ok) {
        throw new Error('Print failed');
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
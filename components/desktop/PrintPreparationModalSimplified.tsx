'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/solid';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import { filterOutDiscounts } from '@/lib/services/orders/normalize';
import { useGloveMode } from '@/contexts/GloveModeProvider';
import WarehouseButton from '@/components/ui/WarehouseButton';
import ProgressBar from '@/components/ui/ProgressBar';

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

interface PrintPreparationModalSimplifiedProps {
  order: FreightOrder;
  onClose: () => void;
  onPrintComplete: () => void;
}

export default function PrintPreparationModalSimplified({ 
  order, 
  onClose, 
  onPrintComplete 
}: PrintPreparationModalSimplifiedProps) {
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  
  // Store regenerated QR codes in ref to avoid async setState issues
  const regeneratedQRsRef = useRef<Record<string, QRCode[]>>({});
  
  const { touchSize } = useGloveMode();

  useEffect(() => {
    fetchQRCodes();
  }, [order.orderId]);

  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/workspace/${order.orderId}/qrcodes`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.qrCodes) {
          setQrCodes(data.qrCodes);
          
          // Initialize quantities based on existing QR codes
          const quantities: Record<string, number> = {};
          const filteredItems = filterOutDiscounts(order.items || []);
          
          filteredItems.forEach(item => {
            const itemQRs = data.qrCodes.filter((qr: QRCode) => 
              qr.encodedData?.itemName === item.name || 
              qr.metadata?.itemName === item.name
            );
            quantities[item.name] = itemQRs.length || 1;
          });
          
          setLabelQuantities(quantities);
        }
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
      
      const response = await fetch(`/api/workspace/${order.orderId}/qrcodes/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName,
          quantity,
          sku: item.sku
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.qrCodes) {
          // Store in ref first to avoid async issues
          regeneratedQRsRef.current[itemName] = data.qrCodes;
          
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-warehouse-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-warehouse-xl">
        {/* Header */}
        <div className="bg-warehouse-info text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-warehouse-2xl font-black">PRINT LABELS</h2>
            <p className="text-warehouse-lg opacity-90">Order #{order.orderNumber}</p>
          </div>
          <WarehouseButton
            onClick={onClose}
            variant="neutral"
            size="base"
            icon={<XMarkIcon className="h-6 w-6" />}
          />
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="py-12">
              <ProgressBar
                value={50}
                label="Loading QR codes"
                showPercentage={false}
                variant="default"
                animated={true}
                className="max-w-md mx-auto"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {filteredItems.map((item, index) => {
                const itemQuantity = labelQuantities[item.name] || 1;
                const isRegenerating = regenerating[item.name] || false;
                
                return (
                  <div 
                    key={`${item.name}-${index}`}
                    className="warehouse-card"
                  >
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Item Info */}
                      <div className="flex-1">
                        <h3 className="text-warehouse-xl font-black text-warehouse-text-primary mb-2">
                          {item.name}
                        </h3>
                        {item.sku && (
                          <p className="text-warehouse-lg text-warehouse-text-secondary">
                            SKU: {item.sku}
                          </p>
                        )}
                        <p className="text-warehouse-lg text-warehouse-text-secondary">
                          Quantity: {item.quantity}
                        </p>
                      </div>
                      
                      {/* Label Quantity Selector */}
                      <div className="flex items-center gap-4">
                        <span className="text-warehouse-lg font-bold uppercase">
                          Labels:
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <WarehouseButton
                            onClick={() => handleQuantityChange(item.name, itemQuantity - 1)}
                            disabled={itemQuantity <= 1 || isRegenerating}
                            variant="neutral"
                            size="large"
                          >
                            <span className="text-2xl">−</span>
                          </WarehouseButton>
                          
                          <input
                            type="number"
                            value={itemQuantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              handleQuantityChange(item.name, val);
                            }}
                            className="w-20 text-center text-warehouse-2xl font-black border-4 border-warehouse-border-heavy rounded-warehouse"
                            style={{ minHeight: touchSize }}
                            min="1"
                          />
                          
                          <WarehouseButton
                            onClick={() => handleQuantityChange(item.name, itemQuantity + 1)}
                            disabled={isRegenerating}
                            variant="go"
                            size="large"
                          >
                            <span className="text-2xl">+</span>
                          </WarehouseButton>
                        </div>
                        
                        {isRegenerating && (
                          <div className="animate-spin h-8 w-8 border-4 border-warehouse-info border-t-transparent rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Summary */}
              <div className="warehouse-card bg-warehouse-bg-highlight">
                <h3 className="text-warehouse-xl font-black mb-4">LABEL SUMMARY</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-warehouse-lg text-warehouse-text-secondary">Total Items:</span>
                    <span className="text-warehouse-2xl font-black ml-4">{filteredItems.length}</span>
                  </div>
                  <div>
                    <span className="text-warehouse-lg text-warehouse-text-secondary">Total Labels:</span>
                    <span className="text-warehouse-2xl font-black ml-4">
                      {Object.values(labelQuantities).reduce((sum, qty) => sum + qty, 0) || qrCodes.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer Actions */}
        <div className="bg-gray-100 p-6 flex justify-end gap-4">
          <WarehouseButton
            onClick={onClose}
            variant="neutral"
            size="large"
          >
            CANCEL
          </WarehouseButton>
          <WarehouseButton
            onClick={handlePrint}
            disabled={printing || loading}
            variant="go"
            size="xlarge"
            loading={printing}
            icon={<PrinterIcon className="h-8 w-8" />}
            haptic="success"
          >
            {printing ? 'PRINTING...' : 'PRINT ALL LABELS'}
          </WarehouseButton>
        </div>
      </div>
    </div>
  );
}
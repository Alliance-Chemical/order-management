'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, PrinterIcon, DocumentCheckIcon } from '@heroicons/react/24/solid';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import QRCodeSummary from './print-preparation/QRCodeSummary';
import { filterOutDiscounts } from '@/lib/services/orders/normalize';
import { useToast } from '@/hooks/use-toast';
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
  type: 'container' | 'pallet';
  label?: string;
  metadata?: any;
  shortCode?: string;
  qrType?: string;
  encodedData?: any;
}

interface PrintPreparationModalProps {
  order: FreightOrder;
  onClose: () => void;
  onPrintComplete: () => void;
}

export default function PrintPreparationModal({ 
  order, 
  onClose, 
  onPrintComplete 
}: PrintPreparationModalProps) {
  const { toast } = useToast()
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [labelSummary, setLabelSummary] = useState<{
    drums: number;
    totes: number;
    pallets: number;
    containers: number;
  }>({ drums: 0, totes: 0, pallets: 0, containers: 0 });
  
  // Track custom label quantities per item
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
  

  useEffect(() => {
    fetchQRCodes();
  }, [order.orderId]);

  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      const result = await getQRCodesForWorkspace(order.orderId.toString());
      if (result.success && result.qrCodes) {
        setQrCodes(result.qrCodes);
        calculateLabelSummary(result.qrCodes);
      }
    } catch (error) {
      console.error('Failed to fetch QR codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateLabelSummary = (codes: QRCode[]) => {
    console.log(`[PrintModal] Calculating label summary for ${codes.length} QR codes`);
    codes.forEach((qr, index) => {
      console.log(`[PrintModal] QR ${index + 1}: type=${qr.qrType}, containerType=${qr.encodedData?.containerType || qr.metadata?.containerType || 'none'}`);
    });

    const summary = {
      drums: 0,
      totes: 0,
      pallets: 0,
      containers: 0
    };

    codes.forEach(qr => {
      const containerType = qr.encodedData?.containerType || qr.metadata?.containerType || '';
      if (containerType.includes('drum')) {
        summary.drums++;
      } else if (containerType.includes('tote')) {
        summary.totes++;
      } else if (containerType.includes('pallet')) {
        summary.pallets++;
      } else {
        summary.containers++;
      }
    });

    console.log(`[PrintModal] Label summary:`, summary);
    setLabelSummary(summary);
    
    // Initialize label quantities based on existing QR codes
    if (order.items) {
      console.log(`[PrintModal] Processing ${order.items.length} order items`);
      const filteredItems = filterOutDiscounts(order.items);
      console.log(`[PrintModal] After filtering discounts: ${filteredItems.length} items`);
      
      const quantities: Record<string, number> = {};
      filteredItems.forEach(item => {
        // Count how many QR codes exist for this item
        const itemQRs = codes.filter(qr => 
          qr.encodedData?.sku === item.sku || 
          qr.encodedData?.itemId === item.sku
        );
        console.log(`[PrintModal] Item ${item.sku} (${item.name}): found ${itemQRs.length} QRs`);
        quantities[item.sku] = itemQRs.length || 1;
      });
      console.log(`[PrintModal] Final label quantities:`, quantities);
      setLabelQuantities(quantities);
    }
  };
  
  const updateLabelQuantity = (sku: string, value: string) => {
    // Validation: allow any positive integer; show error on 0/blank
    if (value.trim() === '') {
      setQuantityErrors((prev) => ({ ...prev, [sku]: 'Enter a positive number' }));
      setLabelQuantities((prev) => ({ ...prev, [sku]: prev[sku] }));
      return;
    }
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty <= 0) {
      setQuantityErrors((prev) => ({ ...prev, [sku]: 'Quantity must be a positive integer' }));
      return;
    }
    setQuantityErrors((prev) => ({ ...prev, [sku]: '' }));
    setLabelQuantities(prev => ({
      ...prev,
      [sku]: qty
    }));
  };

  const handlePrintAll = async () => {
    // Skip fulfillment dialog and print directly
    handleConfirmPrint();
  };

  const handleConfirmPrint = async () => {
    try { warehouseFeedback.buttonPress(); } catch {}
    setPrinting(true);
    
    try {
      // If custom quantities are specified, we need to regenerate QR codes
      const hasCustomQuantities = Object.values(labelQuantities).some(qty => qty !== 1);
      
      let qrCodesToPrint = qrCodes; // Default to existing QR codes
      
      if (hasCustomQuantities) {
        // First, regenerate QR codes with custom quantities
        // Create items array from labelQuantities for server action
        const items = order.items ? filterOutDiscounts(order.items).map(item => ({
          ...item,
          labelCount: labelQuantities[item.sku] || 1
        })) : [];
        
        const regenResult = await regenerateQRCodes(order.orderId.toString(), items);
        
        if (regenResult.success && regenResult.qrCodes) {
          qrCodesToPrint = regenResult.qrCodes; // Use the fresh QR codes
          setQrCodes(regenResult.qrCodes); // Also update state for UI
        }
      }
      
      // Only print container QRs - use the correct array
      const containerQRs = qrCodesToPrint.filter(qr => qr.qrType === 'container');
      
      // Use server action for printing - extract QR codes for printing
      const qrCodeStrings = containerQRs.map(qr => qr.shortCode || qr.code);
      
      const printResult = await printQR(qrCodeStrings);

      if (!printResult.success) {
        throw new Error('Print failed');
      }

      // The server action returns print data - create PDF from the data
      if (printResult.printData) {
        // For now, we'll create a simple text download as the server action
        // returns base64 images. In production, you might want to enhance
        // the server action to return a PDF blob
        const printContent = printResult.printData.map(item => 
          `QR Code: ${item.code}\nImage: ${item.image}`
        ).join('\n\n');
        
        const blob = new Blob([printContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `labels-${order.orderNumber}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      // Haptic + audio success feedback
      try { warehouseFeedback.success(); } catch {}

      // Show success message
      toast({
        title: "Success",
        description: `Labels printed successfully for Order ${order.orderNumber}`
      })
      onPrintComplete();
    } catch (error) {
      console.error('Print error:', error);
      try { warehouseFeedback.error(); } catch {}
      toast({
        title: "Error",
        description: "Failed to print labels",
        variant: "destructive"
      })
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
          {/* Header */}
          <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              Label Printing - Order #{order.orderNumber}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading QR codes...</p>
              </div>
            ) : (
              <>
                {/* QR Code Summary */}
                <QRCodeSummary
                  summary={labelSummary}
                  hasUnassignedItems={false}
                />

                {/* Order Items List with Label Quantity Selectors */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Items</h3>
                    <div className="space-y-3">
                      {filterOutDiscounts(order.items)
                        .map((item: any, index: number) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{item.name || 'Unknown Product'}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  SKU: {item.sku || 'N/A'} | Order Qty: {item.quantity || 1}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <label className="text-sm text-gray-700 whitespace-nowrap">
                                  Labels to print:
                                </label>
                                <input
                                  type="number"
                                  value={labelQuantities[item.sku] || 1}
                                  onChange={(e) => updateLabelQuantity(item.sku, e.target.value)}
                                  className="w-20 px-2 py-1 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            </div>
                            {quantityErrors[item.sku] && (
                              <div className="text-xs text-red-600 mt-2">
                                {quantityErrors[item.sku]}
                              </div>
                            )}
                            {labelQuantities[item.sku] > 1 && (
                              <div className="text-xs text-gray-500 mt-2">
                                Will print {labelQuantities[item.sku]} labels for this item
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-3">
            <button
              onClick={() => { try { warehouseFeedback.buttonPress(); } catch {}; onClose(); }}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePrintAll}
              disabled={
                printing ||
                qrCodes.length === 0 ||
                Object.values(quantityErrors).some((e) => e && e.length > 0)
              }
              className={`inline-flex items-center px-6 py-2 rounded-lg font-semibold transition-colors ${
                !printing && qrCodes.length > 0 && !Object.values(quantityErrors).some((e) => e && e.length > 0)
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <PrinterIcon className="h-5 w-5 mr-2" />
              {printing ? 'Printing...' : 'Print All Labels'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

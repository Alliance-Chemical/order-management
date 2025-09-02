'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, PrinterIcon, DocumentCheckIcon } from '@heroicons/react/24/solid';
import QRCodeSummary from './print-preparation/QRCodeSummary';

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
          calculateLabelSummary(data.qrCodes);
        }
      }
    } catch (error) {
      console.error('Failed to fetch QR codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateLabelSummary = (codes: QRCode[]) => {
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

    setLabelSummary(summary);
    
    // Initialize label quantities based on existing QR codes
    if (order.items) {
      const quantities: Record<string, number> = {};
      order.items
        .filter((item: any) => {
          // Filter out discount codes and items with no SKU
          const hasNoSku = !item.sku || item.sku === '';
          const isDiscount = item.name?.toLowerCase().includes('discount') || 
                           item.name?.toLowerCase().includes('welcome') ||
                           item.unitPrice < 0;
          return !(hasNoSku && isDiscount);
        })
        .forEach(item => {
          // Count how many QR codes exist for this item
          const itemQRs = codes.filter(qr => 
            qr.encodedData?.sku === item.sku || 
            qr.encodedData?.itemId === item.sku
          );
          quantities[item.sku] = itemQRs.length || 1;
        });
      setLabelQuantities(quantities);
    }
  };
  
  const updateLabelQuantity = (sku: string, quantity: string) => {
    const qty = parseInt(quantity) || 1;
    setLabelQuantities(prev => ({
      ...prev,
      [sku]: Math.max(1, qty) // No upper limit, minimum 1
    }));
  };

  const handlePrintAll = async () => {
    // Skip fulfillment dialog and print directly
    handleConfirmPrint();
  };

  const handleConfirmPrint = async () => {
    setPrinting(true);
    
    try {
      // If custom quantities are specified, we need to regenerate QR codes
      const hasCustomQuantities = Object.values(labelQuantities).some(qty => qty !== 1);
      
      let qrCodesToPrint = qrCodes; // Default to existing QR codes
      
      if (hasCustomQuantities) {
        // First, regenerate QR codes with custom quantities
        const regenResponse = await fetch(`/api/workspace/${order.orderId}/qrcodes/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            labelQuantities
          })
        });
        
        if (regenResponse.ok) {
          const regenData = await regenResponse.json();
          if (regenData.success && regenData.qrCodes) {
            qrCodesToPrint = regenData.qrCodes; // Use the fresh QR codes
            setQrCodes(regenData.qrCodes); // Also update state for UI
          }
        }
      }
      
      // Only print container QRs - use the correct array
      const containerQRs = qrCodesToPrint.filter(qr => qr.qrType === 'container');
      
      const response = await fetch('/api/qr/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qrCodes: containerQRs,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          labelQuantities // Pass custom quantities to print API
        })
      });

      if (!response.ok) {
        throw new Error('Print failed');
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labels-${order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Show success message
      alert(`Labels printed successfully for Order ${order.orderNumber}`);
      onPrintComplete();
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to print labels');
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
                      {order.items
                        .filter((item: any) => {
                          // Filter out discount codes and items with no SKU
                          const hasNoSku = !item.sku || item.sku === '';
                          const isDiscount = item.name?.toLowerCase().includes('discount') || 
                                           item.name?.toLowerCase().includes('welcome') ||
                                           item.unitPrice < 0;
                          return !(hasNoSku && isDiscount);
                        })
                        .map((item: any, index: number) => {
                        const isFreightItem = item.name && (
                          item.name.toLowerCase().includes('case') ||
                          item.name.toLowerCase().includes('pail') ||
                          item.name.toLowerCase().includes('box') ||
                          (item.name.toLowerCase().includes('gallon') && 
                           !item.name.toLowerCase().includes('drum') && 
                           !item.name.toLowerCase().includes('tote'))
                        );
                        
                        return (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{item.name || 'Unknown Product'}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  SKU: {item.sku || 'N/A'} | Order Qty: {item.quantity || 1}
                                </div>
                                {isFreightItem && (
                                  <div className="text-xs text-blue-600 mt-1">
                                    💡 Freight item - typically ships on pallet(s)
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <label className="text-sm text-gray-700 whitespace-nowrap">
                                  Labels to print:
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={labelQuantities[item.sku] || 1}
                                  onChange={(e) => updateLabelQuantity(item.sku, e.target.value)}
                                  className="w-20 px-2 py-1 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            </div>
                            {labelQuantities[item.sku] > 1 && (
                              <div className="text-xs text-gray-500 mt-2">
                                Will print {labelQuantities[item.sku]} labels for this item
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePrintAll}
              disabled={printing || qrCodes.length === 0}
              className={`inline-flex items-center px-6 py-2 rounded-lg font-semibold transition-colors ${
                !printing && qrCodes.length > 0
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
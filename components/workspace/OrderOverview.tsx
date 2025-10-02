'use client';

import { useState } from 'react';
import { useFreightOrder } from '@/lib/swr/hooks';
import { generateQR } from '@/app/actions/qr';
import { syncShipStationData } from '@/app/actions/workspace';
// import { toast } from 'sonner';
import Image from 'next/image';
import { ImageViewer } from '@/components/ui/image-viewer';
import type { OrderWorkspace } from '@/lib/types/workspace';
import type { SSAddress, SSItem, SSOrder, SSOption } from '@/types/shipstation';

type WorkspaceWithShipStation = OrderWorkspace & {
  shipstationData?: SSOrder;
  syncStatus?: 'synced' | 'pending' | 'failed';
  lastShipstationSync?: Date | string | null;
};

type FreightOrderSummary = {
  bookingStatus?: string;
  carrierName?: string;
  serviceType?: string;
  trackingNumber?: string;
  estimatedCost?: string;
  bookedAt?: string;
  specialInstructions?: string;
  aiSuggestions?: Array<{ reasoning?: string }>;
  confidenceScore?: string;
};

interface OrderOverviewProps {
  orderId: string;
  workspace: WorkspaceWithShipStation;
}

export default function OrderOverview({ orderId, workspace }: OrderOverviewProps) {
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isPrintingPackingSlip, setIsPrintingPackingSlip] = useState(false);
  const [showPackingSlipMenu, setShowPackingSlipMenu] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const order = (workspace.shipstationData ?? {}) as SSOrder;
  const shipTo = (order.shipTo ?? {}) as SSAddress;
  const items: SSItem[] = Array.isArray(order.items) ? order.items : [];
  
  // Fetch freight order data
  const { order: freightOrder, isLoading: isLoadingFreight } = useFreightOrder(orderId) as {
    order?: FreightOrderSummary | null;
    isLoading: boolean;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const handleGenerateQR = async () => {
    setIsGeneratingQR(true);
    try {
      const result = await generateQR({
        orderId: orderId,
        orderNumber: workspace.orderNumber,
        type: 'order_master'
      });

      if (result.success) {
        // toast.success('QR codes generated successfully');
        console.log('QR codes generated successfully');
        // Refresh the page or update state
        window.location.reload();
      } else {
        // toast.error('Failed to generate QR codes');
        console.error('Failed to generate QR codes:', result.error);
      }
    } catch (error) {
      console.error('Error generating QR codes:', error);
      // toast.error('Failed to generate QR codes');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handlePrintPackingSlip = async (size: '4x6' | 'letter') => {
    setIsPrintingPackingSlip(true);
    setShowPackingSlipMenu(false);
    try {
      const response = await fetch(`/api/workspace/${orderId}/packing-slip?size=${size}`);

      if (!response.ok) {
        throw new Error('Failed to generate packing slip');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `packing-slip-${workspace.orderNumber}-${size}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log(`Packing slip generated successfully (${size})`);
    } catch (error) {
      console.error('Error generating packing slip:', error);
      alert('Failed to generate packing slip. Please try again.');
    } finally {
      setIsPrintingPackingSlip(false);
    }
  };

  const handleSyncShipStation = async () => {
    setIsSyncing(true);
    try {
      const result = await syncShipStationData(orderId);

      if (result.success) {
        console.log('ShipStation data synced successfully');
        window.location.reload();
      } else {
        console.error('Failed to sync ShipStation data:', result.error);
        alert(`Failed to sync: ${result.error}`);
      }
    } catch (error) {
      console.error('Error syncing ShipStation data:', error);
      alert('Failed to sync ShipStation data. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span data-testid="phase-pill" className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {workspace.workflowPhase?.replace('_', ' ').toUpperCase() || 'PENDING'}
            </span>
            <span data-testid="order-number" className="text-sm text-gray-600">
              Order #{workspace.orderNumber}
            </span>
            {/* ShipStation Sync Status */}
            {workspace.syncStatus === 'pending' && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1" title="ShipStation data sync pending">
                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Pending
              </span>
            )}
            {workspace.syncStatus === 'failed' && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium" title="ShipStation sync failed - click Sync button to retry">
                ⚠️ Sync Failed
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setShowPackingSlipMenu(!showPackingSlipMenu)}
                disabled={isPrintingPackingSlip}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Print packing slip for this order"
              >
                {isPrintingPackingSlip ? 'Generating...' : '📄 Print Packing Slip'}
                {!isPrintingPackingSlip && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              {showPackingSlipMenu && !isPrintingPackingSlip && (
                <div className="absolute top-full mt-1 left-0 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10 min-w-[200px]">
                  <button
                    onClick={() => handlePrintPackingSlip('4x6')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm"
                  >
                    4" x 6" Label Size
                  </button>
                  <button
                    onClick={() => handlePrintPackingSlip('letter')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm"
                  >
                    8.5" x 11" Paper Size
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleGenerateQR}
              disabled={isGeneratingQR}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingQR ? 'Generating...' : 'Generate QR'}
            </button>
            <button
              data-testid="lock-planning-btn"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Lock Planning
            </button>
            <button
              data-testid="sync-shipstation-btn"
              onClick={handleSyncShipStation}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Force sync ShipStation data"
            >
              {isSyncing ? 'Syncing...' : 'Sync ShipStation'}
            </button>
          </div>
        </div>
      </div>
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-slate-500">Items</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{items.length}</p>
        </div>
      </div>

      {/* Customer Information */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer Information</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-500">Address</p>
            <div className="text-sm text-slate-700 mt-1">
              <p className="font-medium text-slate-900">{shipTo.name || 'N/A'}</p>
              <p>{shipTo.street1}</p>
              {shipTo.street2 && <p>{shipTo.street2}</p>}
              <p>{shipTo.city}, {shipTo.state} {shipTo.postalCode}</p>
              <p>{shipTo.country}</p>
            </div>
          </div>
          {shipTo.phone && (
            <div>
              <p className="text-sm text-slate-500">Phone</p>
              <p className="text-sm text-slate-700 mt-1">{shipTo.phone}</p>
            </div>
          )}
          {order.customerEmail && (
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="text-sm text-slate-700 mt-1">{order.customerEmail}</p>
            </div>
          )}
        </div>
      </div>

      {/* Freight Information */}
      {freightOrder && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            📦 Freight Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                freightOrder.bookingStatus === 'delivered' ? 'bg-green-100 text-green-800' :
                freightOrder.bookingStatus === 'shipped' ? 'bg-blue-100 text-blue-800' :
                freightOrder.bookingStatus === 'booked' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {freightOrder.bookingStatus?.toUpperCase() || 'PENDING'}
              </span>
            </div>
            
            {freightOrder.carrierName && (
              <div>
                <p className="text-sm text-slate-500">Carrier</p>
                <p className="text-sm text-slate-700 mt-1">{freightOrder.carrierName}</p>
              </div>
            )}
            
            {freightOrder.serviceType && (
              <div>
                <p className="text-sm text-slate-500">Service Type</p>
                <p className="text-sm text-slate-700 mt-1">{freightOrder.serviceType}</p>
              </div>
            )}
            
            {freightOrder.trackingNumber && (
              <div>
                <p className="text-sm text-slate-500">Tracking Number</p>
                <p className="text-sm text-slate-700 mt-1 font-mono">{freightOrder.trackingNumber}</p>
              </div>
            )}
            
            {freightOrder.estimatedCost && (
              <div>
                <p className="text-sm text-slate-500">Estimated Cost</p>
                <p className="text-sm text-slate-700 mt-1">{formatCurrency(parseFloat(freightOrder.estimatedCost))}</p>
              </div>
            )}
            
            {freightOrder.bookedAt && (
              <div>
                <p className="text-sm text-slate-500">Booked Date</p>
                <p className="text-sm text-slate-700 mt-1">{new Date(freightOrder.bookedAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
          
          {freightOrder.specialInstructions && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">Special Instructions</p>
              <p className="text-sm text-slate-600 bg-amber-50 rounded p-3">{freightOrder.specialInstructions}</p>
            </div>
          )}
          
          {freightOrder.aiSuggestions && freightOrder.aiSuggestions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">AI Recommendations</p>
              <div className="text-sm text-slate-600 bg-blue-50 rounded p-3">
                <p>Confidence: {freightOrder.confidenceScore ? `${(parseFloat(freightOrder.confidenceScore) * 100).toFixed(0)}%` : 'N/A'}</p>
                {freightOrder.aiSuggestions[0]?.reasoning && (
                  <p className="mt-1">{freightOrder.aiSuggestions[0].reasoning}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {isLoadingFreight && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            📦 Freight Information
          </h3>
          <div className="animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      )}

      {/* Order Items */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Order Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">Qty</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Unit Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {items.map((item: SSItem, index: number) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {item.imageUrl && (
                        <ImageViewer
                          src={item.imageUrl}
                          alt={item.name ?? 'Product image'}
                          title={item.name ?? 'Product'}
                          subtitle={`SKU: ${item.sku ?? 'N/A'} • ${item.quantity ?? 1} units`}
                        >
                          <Image
                            src={item.imageUrl}
                            alt={item.name ?? 'Product image'}
                            width={80}
                            height={80}
                            className="h-20 w-20 rounded-lg object-cover mr-4 border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </ImageViewer>
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        {item.options && item.options.length > 0 && (
                          <p className="text-xs text-slate-500">
                            {item.options.map((opt: SSOption) => `${opt.name}: ${opt.value}`).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{item.sku}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 text-center">{item.quantity}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 text-right">{formatCurrency(item.unitPrice ?? 0)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 text-right">
                    {formatCurrency((item.unitPrice ?? 0) * (item.quantity ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      {/* Tags */}
      {order?.tagIds && Array.isArray(order.tagIds) && order.tagIds.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {order.tagIds.map((tagId: number) => (
              <span 
                key={tagId}
                className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-sm"
              >
                Tag #{tagId}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {(order.customerNotes || order.internalNotes) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Notes</h3>
          {order.customerNotes && (
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Customer Notes</p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded p-3">{order.customerNotes}</p>
            </div>
          )}
          {order.internalNotes && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Internal Notes</p>
              <p className="text-sm text-slate-600 bg-amber-50 rounded p-3">{order.internalNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

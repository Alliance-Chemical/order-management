'use client';

import { useState, useEffect } from 'react';
import { useFreightOrder } from '@/lib/swr/hooks';
import { generateQR } from '@/app/actions/qr';
// import { toast } from 'sonner';

interface OrderOverviewProps {
  orderId: string;
  workspace: any;
  initialState?: any;
  onStateChange?: (state: any) => void;
}

export default function OrderOverview({ orderId, workspace }: OrderOverviewProps) {
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const order = workspace.shipstationData || {};
  const shipTo = order.shipTo || {};
  const items = order.items || [];
  
  // Fetch freight order data
  const { order: freightOrder, isLoading: isLoadingFreight } = useFreightOrder(orderId);

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
        type: 'master'
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
          </div>
          <div className="flex gap-2">
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Sync to ShipStation
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
              {items.map((item: any, index: number) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {item.imageUrl && (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          className="h-10 w-10 rounded object-cover mr-3"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        {item.options?.length > 0 && (
                          <p className="text-xs text-slate-500">
                            {item.options.map((opt: any) => `${opt.name}: ${opt.value}`).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{item.sku}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 text-center">{item.quantity}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 text-right">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      {/* Tags */}
      {order.tagIds?.length > 0 && (
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
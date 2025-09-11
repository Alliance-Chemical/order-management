'use client';

import { TruckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { formatWarehouseText } from '@/lib/warehouse-ui-utils';
import type { ShipStationOrder } from '@/types/freight-booking';

interface OrderSelectionStepProps {
  availableOrders: ShipStationOrder[];
  loading: boolean;
  onOrderSelect: (order: ShipStationOrder) => void;
  onRefresh: () => void;
  warehouseFeedback: any;
}

export default function OrderSelectionStep({
  availableOrders,
  loading,
  onOrderSelect,
  onRefresh,
  warehouseFeedback
}: OrderSelectionStepProps) {
  return (
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
              onRefresh();
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
                onOrderSelect(order);
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
  );
}
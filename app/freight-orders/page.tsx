'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface FreightOrder {
  orderId: number;
  orderNumber: string;
  workspaceId?: string;
  workspaceUrl?: string;
  customerName?: string;
  orderDate?: string;
  orderTotal?: number;
  items?: any[];
}

export default function FreightOrdersPage() {
  const [orders, setOrders] = useState<FreightOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [stats, setStats] = useState<any>({});
  const router = useRouter();

  const pollFreightOrders = async () => {
    setPolling(true);
    try {
      const response = await fetch('/api/freight-orders/poll');
      const data = await response.json();
      
      if (data.success) {
        setStats({
          total: data.totalFreightOrders,
          new: data.newWorkspaces,
          existing: data.existingWorkspaces,
        });
        
        // Combine created and existing orders
        const allOrders = [
          ...data.created.map((o: any) => ({ ...o, isNew: true })),
          ...data.existing.map((o: any) => ({ ...o, isNew: false })),
        ];
        setOrders(allOrders);
      }
    } catch (error) {
      console.error('Error polling orders:', error);
      alert('Failed to fetch freight orders');
    } finally {
      setPolling(false);
    }
  };

  const searchFreightOrders = async () => {
    setLoading(true);
    try {
      const freightTagId = 19844; // Your freight tag ID
      
      const response = await fetch('/api/shipstation/orders/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId: freightTagId }),
      });
      
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error searching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async (orderId: number, orderNumber: string) => {
    try {
      const response = await fetch('/api/freight-orders/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderNumber }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Navigate to the new workspace
        router.push(data.workspaceUrl);
      } else {
        alert(data.error || 'Failed to create workspace');
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert('Failed to create workspace');
    }
  };

  useEffect(() => {
    pollFreightOrders();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Freight Order Management
          </h1>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={pollFreightOrders}
              disabled={polling}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {polling ? 'Polling...' : 'Poll Freight Orders'}
            </button>
            
            {stats.total && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Total: <strong>{stats.total}</strong>
                </span>
                <span className="text-green-600">
                  New: <strong>{stats.new}</strong>
                </span>
                <span className="text-blue-600">
                  Existing: <strong>{stats.existing}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="text-sm text-gray-500 mb-4">
            This will search ShipStation for orders with the freight tag (ID: 19844) 
            from the last 7 days and create workspaces for them.
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Freight Orders
            </h2>
          </div>
          
          <div className="p-6">
            {polling ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Searching for freight orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No freight orders found. Click "Poll Freight Orders" to search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.orderId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {order.orderNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.orderId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.workspaceId ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Workspace Exists
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              No Workspace
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {order.workspaceId ? (
                            <button
                              onClick={() => router.push(`/workspace/${order.orderId}`)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Open Workspace →
                            </button>
                          ) : (
                            <button
                              onClick={() => createWorkspace(order.orderId, order.orderNumber)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Create Workspace
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
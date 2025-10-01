'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TruckIcon } from '@heroicons/react/24/solid';
import { warehouseFeedback, formatWarehouseText } from '@/lib/warehouse-ui-utils';
import FreightNavigation from '@/components/navigation/FreightNavigation';
import ProgressBar from '@/components/ui/ProgressBar';
import { useToast } from '@/hooks/use-toast';
import FreightHUD from '@/components/workspace/supervisor-view/FreightHUD';

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

function FreightOrdersContent() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<FreightOrder[]>([]);
  const [, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [stats, setStats] = useState<any>({});
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get('tab') === 'hud') ? 'hud' : (searchParams?.get('tab') === 'ready') ? 'ready' : 'orders';
  const [activeTab, setActiveTab] = useState<'orders' | 'ready' | 'hud'>(initialTab as any);
  const [readyOrders, setReadyOrders] = useState<any[]>([]);
  const [readyLoading, setReadyLoading] = useState(false);
  const [readyError, setReadyError] = useState<string | null>(null);

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
      toast({
        title: "Error",
        description: "Failed to fetch freight orders",
        variant: "destructive"
      })
    } finally {
      setPolling(false);
    }
  };

  const loadBookingReady = async () => {
    setReadyLoading(true);
    setReadyError(null);
    try {
      const res = await fetch('/api/booking-ready', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load');
      setReadyOrders(data.orders || []);
    } catch (e: any) {
      console.error('Error loading booking-ready:', e);
      setReadyError(e?.message || 'Failed to load');
    } finally {
      setReadyLoading(false);
    }
  };

  const _searchFreightOrders = async () => {
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
        toast({
          title: "Error",
          description: data.error || "Failed to create workspace",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast({
        title: "Error",
        description: "Failed to create workspace",
        variant: "destructive"
      })
    }
  };

  useEffect(() => {
    pollFreightOrders();
    if (initialTab === 'ready') {
      loadBookingReady();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <FreightNavigation className="bg-white shadow-sm border-b px-6 py-4" />
      
      <div className="max-w-6xl mx-auto p-8">
        <div className="bg-white rounded-warehouse shadow-warehouse p-6 mb-6">
          <h1 className="text-warehouse-3xl font-black text-gray-900 uppercase mb-4">
            {formatWarehouseText('Freight Order Management', 'critical')}
          </h1>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                warehouseFeedback.buttonPress();
                pollFreightOrders();
              }}
              disabled={polling}
              className="px-8 py-6 bg-warehouse-info text-white rounded-warehouse text-warehouse-xl font-black hover:bg-blue-700 disabled:bg-gray-400 transition-colors shadow-warehouse border-b-4 border-blue-800 disabled:border-gray-500 active:scale-95"
              style={{ minHeight: '80px' }}
            >
              {polling ? '⏳ POLLING...' : '🔄 POLL FREIGHT ORDERS'}
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
          {/* Tabs */}
          <div className="px-6 pt-4 border-b border-gray-200 flex gap-2">
            <button
              onClick={() => setActiveTab('hud')}
              className={`px-3 py-2 text-sm rounded-md font-semibold ${activeTab === 'hud' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              🎛️ Supervisor HUD
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-2 text-sm rounded-md ${activeTab === 'orders' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              All Freight Orders
            </button>
            <button
              onClick={() => {
                setActiveTab('ready');
                if (readyOrders.length === 0 && !readyLoading) loadBookingReady();
              }}
              className={`px-3 py-2 text-sm rounded-md ${activeTab === 'ready' ? 'bg-green-50 text-green-700 border border-green-200' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Booking Ready
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'hud' && (
              <FreightHUD />
            )}

            {activeTab === 'orders' && (
              polling ? (
                <div className="py-8">
                  <ProgressBar
                    value={30}
                    label="Searching for freight orders"
                    showPercentage={false}
                    variant="default"
                    animated={true}
                    className="max-w-md mx-auto"
                  />
                  <p className="mt-4 text-gray-600 text-center">Searching for freight orders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No freight orders found. Click &quot;Poll Freight Orders&quot; to search.
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2">
                              {order.workspaceId ? (
                                <button
                                  onClick={() => {
                                    warehouseFeedback.buttonPress();
                                    router.push(`/workspace/${order.orderId}`);
                                  }}
                                  className="px-6 py-4 bg-warehouse-info text-white rounded-warehouse text-warehouse-lg font-black hover:bg-blue-700 transition-colors shadow-warehouse border-b-4 border-blue-800 active:scale-95"
                                  style={{ minHeight: '60px' }}
                                >
                                  📂 OPEN WORKSPACE
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    warehouseFeedback.success();
                                    createWorkspace(order.orderId, order.orderNumber);
                                  }}
                                  className="px-6 py-4 bg-warehouse-go text-white rounded-warehouse text-warehouse-lg font-black hover:bg-green-700 transition-colors shadow-warehouse border-b-4 border-green-800 active:scale-95"
                                  style={{ minHeight: '60px' }}
                                >
                                  ➕ CREATE WORKSPACE
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  warehouseFeedback.buttonPress();
                                  router.push(`/freight-booking?orderId=${order.orderId}`);
                                }}
                                className="px-6 py-4 bg-warehouse-caution text-white rounded-warehouse text-warehouse-lg font-black hover:bg-amber-600 transition-colors shadow-warehouse border-b-4 border-amber-700 active:scale-95 animate-pulse"
                                style={{ minHeight: '60px' }}
                              >
                                <TruckIcon className="h-5 w-5 inline mr-2" />
                                BOOK FREIGHT
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {activeTab === 'ready' && (
              readyLoading ? (
                <div className="py-8">
                  <ProgressBar
                    value={30}
                    label="Loading booking-ready orders"
                    showPercentage={false}
                    variant="success"
                    animated={true}
                    className="max-w-md mx-auto"
                  />
                  <p className="mt-4 text-gray-600 text-center">Loading booking-ready orders…</p>
                </div>
              ) : readyError ? (
                <div className="text-center py-8 text-red-600">{readyError}</div>
              ) : readyOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No orders are ready right now.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dimensions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {readyOrders.map((o: any) => {
                        const d = o.finalMeasurements?.dimensions;
                        const w = o.finalMeasurements?.weight;
                        return (
                          <tr key={o.orderId}>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-900">#{o.orderNumber}</div>
                              <div className="text-xs text-gray-500">ID: {o.orderId}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-800">{o.customerName || '—'}</td>
                            <td className="px-6 py-4 text-gray-800">{d ? `${d.length} × ${d.width} × ${d.height} ${d.units}` : '—'}</td>
                            <td className="px-6 py-4 text-gray-800">{w ? `${w.value} ${w.units}` : '—'}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button
                                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                  onClick={() => router.push(`/freight-booking?orderId=${o.orderId}`)}
                                >
                                  Open in Booking
                                </button>
                                <button
                                  className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                                  onClick={() => router.push(`/workspace/${o.orderId}`)}
                                >
                                  Open Workspace
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FreightOrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          <ProgressBar
            value={30}
            label="Loading"
            showPercentage={false}
            variant="default"
            animated={true}
          />
          <p className="mt-4 text-gray-600 text-center">Loading...</p>
        </div>
      </div>
    }>
      <FreightOrdersContent />
    </Suspense>
  );
}

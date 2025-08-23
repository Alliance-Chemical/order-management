'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { PrinterIcon, ClipboardDocumentCheckIcon, ChevronDownIcon, ChevronRightIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import PrintPreparationModal from '@/components/desktop/PrintPreparationModal';

interface OrderItem {
  name: string;
  quantity: number;
  sku: string;
}

interface FreightOrder {
  orderId: number;
  orderNumber: string;
  workspaceId?: string;
  customerName?: string;
  orderDate?: string;
  orderTotal?: number;
  items?: OrderItem[];
}

export default function WorkQueueDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<FreightOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<FreightOrder | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  const fetchFreightOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/freight-orders/poll');
      const data = await response.json();
      
      if (data.success) {
        // Combine created and existing orders that have workspaces
        const ordersWithWorkspaces = [
          ...data.created,
          ...data.existing,
        ].filter(order => order.workspaceId);
        
        console.log('Orders received:', ordersWithWorkspaces);
        setOrders(ordersWithWorkspaces);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFreightOrders();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchFreightOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const handlePrepareAndPrint = (order: FreightOrder) => {
    setSelectedOrder(order);
    setShowPrintModal(true);
  };

  const handlePrintComplete = () => {
    setShowPrintModal(false);
    setSelectedOrder(null);
    // Refresh the list
    fetchFreightOrders();
  };

  const toggleOrderExpanded = (orderId: number) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const navigateToWorkspace = (orderId: number) => {
    // Navigate to workspace with supervisor view
    router.push(`/workspace/${orderId}?view=supervisor`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Work Queue Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Available orders ready for label printing and processing
              </p>
            </div>
            <button
              onClick={fetchFreightOrders}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-blue-600">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <ClipboardDocumentCheckIcon className="h-6 w-6 mr-2" />
              Available Orders
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" data-testid="loading-spinner"></div>
              <p className="mt-4 text-gray-600">Loading available orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ClipboardDocumentCheckIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg">No orders available for processing</p>
              <p className="text-sm mt-2">Orders will appear here when tagged for freight processing</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Date
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <Fragment key={order.orderId}>
                      <tr className="hover:bg-gray-50 transition-colors" data-testid="order-card">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Toggling order:', order.orderId, 'Items:', order.items);
                              toggleOrderExpanded(order.orderId);
                            }}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            disabled={!order.items || order.items.length === 0}
                            title={order.items && order.items.length > 0 ? `View ${order.items.length} items` : 'No items'}
                          >
                            {order.items && order.items.length > 0 ? (
                              expandedOrders.has(order.orderId) ? (
                                <ChevronDownIcon className="h-5 w-5 text-gray-600" />
                              ) : (
                                <ChevronRightIcon className="h-5 w-5 text-gray-600" />
                              )
                            ) : (
                              <span className="inline-block w-5 h-5 text-gray-400" title="No items">—</span>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900" data-testid="order-number">
                            {order.orderNumber}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {order.orderId}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900" data-testid="customer-name">
                            {order.customerName || 'Unknown Customer'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {order.orderDate 
                              ? new Date(order.orderDate).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToWorkspace(order.orderId);
                              }}
                              className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
                              title="Open Workspace"
                            >
                              <ArrowRightIcon className="h-4 w-4 mr-1" />
                              Workspace
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrepareAndPrint(order);
                              }}
                              className="inline-flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
                            >
                              <PrinterIcon className="h-4 w-4 mr-1" />
                              Print Labels
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedOrders.has(order.orderId) && order.items && order.items.length > 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-gray-50">
                            <div className="ml-8">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Order Items ({order.items.length})</h4>
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {order.items.map((item, idx) => (
                                      <tr key={idx}>
                                        <td className="px-4 py-2 text-sm text-gray-900">{item.sku || 'N/A'}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                                        <td className="px-4 py-2 text-sm text-gray-900 text-center">{item.quantity}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Print Preparation Modal */}
      {showPrintModal && selectedOrder && (
        <PrintPreparationModal
          order={selectedOrder}
          onClose={() => setShowPrintModal(false)}
          onPrintComplete={handlePrintComplete}
        />
      )}
    </div>
  );
}
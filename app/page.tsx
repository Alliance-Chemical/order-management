'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { PrinterIcon, ClipboardDocumentCheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import PrintPreparationModal from '@/components/desktop/PrintPreparationModal';
import FreightNavigation from '@/components/navigation/FreightNavigation';

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
  freightStatus?: string;
  carrierName?: string;
  trackingNumber?: string;
}

export default function WorkQueueDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<FreightOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<FreightOrder | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(25); // Show 25 orders per page

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

  // Calculate pagination
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(orders.length / ordersPerPage);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    // Reset expanded orders when changing pages
    setExpandedOrders(new Set());
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
            <div className="flex items-center gap-4">
              <FreightNavigation />
              <button
                onClick={fetchFreightOrders}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-blue-600">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <ClipboardDocumentCheckIcon className="h-6 w-6 mr-2" />
              Available Orders {orders.length > 0 && `(${orders.length} total)`}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Freight Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentOrders.map((order) => (
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            {order.freightStatus ? (
                              <div className="flex flex-col">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  order.freightStatus === 'delivered' ? 'bg-green-100 text-green-800' :
                                  order.freightStatus === 'shipped' ? 'bg-blue-100 text-blue-800' :
                                  order.freightStatus === 'booked' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {order.freightStatus.toUpperCase()}
                                </span>
                                {order.carrierName && (
                                  <span className="text-xs text-gray-500 mt-1">{order.carrierName}</span>
                                )}
                                {order.trackingNumber && (
                                  <span className="text-xs text-gray-500">{order.trackingNumber}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">No freight booking</span>
                            )}
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
                            {!order.freightStatus ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/freight-booking?orderId=${order.orderId}`);
                                }}
                                className="inline-flex items-center px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
                                title="Book freight shipping for this order"
                              >
                                🚛 Book Freight
                              </button>
                            ) : (
                              <div className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg">
                                <span className="text-xs">Freight Booked</span>
                              </div>
                            )}
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
                          <td colSpan={7} className="px-6 py-4 bg-gray-50">
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
              
              {/* Pagination Controls */}
              {orders.length > ordersPerPage && (
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{indexOfFirstOrder + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(indexOfLastOrder, orders.length)}
                        </span>{' '}
                        of <span className="font-medium">{orders.length}</span> orders
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Previous</span>
                          <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                        
                        {/* Page numbers */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => paginate(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === pageNum
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => paginate(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Next</span>
                          <ChevronRightIcon className="h-5 w-5" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
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
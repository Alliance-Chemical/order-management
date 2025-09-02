'use client';

import React, { useState } from 'react';
import { TruckIcon, XMarkIcon, BellIcon, BellSlashIcon } from '@heroicons/react/24/solid';
import { useFreightAlerts } from '@/providers/FreightAlertProvider';
import { useRouter } from 'next/navigation';

export function FreightAlertBadge() {
  const router = useRouter();
  const { 
    newOrderCount, 
    unseenOrders, 
    markOrderAsSeen, 
    clearAllNotifications,
    soundEnabled,
    toggleSound
  } = useFreightAlerts();
  const [showDropdown, setShowDropdown] = useState(false);

  if (newOrderCount === 0 && !showDropdown) {
    return null; // Don't show badge when no new orders
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="relative">
        {/* Badge Button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`
            relative flex items-center justify-center w-12 h-12 rounded-full
            bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all
            ${newOrderCount > 0 ? 'animate-pulse-subtle' : ''}
          `}
        >
          <TruckIcon className="h-6 w-6" />
          {newOrderCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold bg-red-500 text-white rounded-full">
              {newOrderCount}
            </span>
          )}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute top-14 right-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">New Freight Orders</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSound}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title={soundEnabled ? 'Mute notifications' : 'Enable sound'}
                >
                  {soundEnabled ? (
                    <BellIcon className="h-4 w-4 text-gray-600" />
                  ) : (
                    <BellSlashIcon className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Orders List */}
            <div className="max-h-80 overflow-y-auto">
              {unseenOrders.length > 0 ? (
                <>
                  {unseenOrders.slice(0, 5).map((order) => (
                    <div
                      key={order.orderId}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => {
                        markOrderAsSeen(order.orderId);
                        router.push(`/freight-booking?orderId=${order.orderId}`);
                        setShowDropdown(false);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Order #{order.orderNumber}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {order.customerName || 'Unknown Customer'}
                          </p>
                          {order.orderDate && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(order.orderDate).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          New
                        </span>
                      </div>
                    </div>
                  ))}
                  {unseenOrders.length > 5 && (
                    <div className="px-4 py-2 text-center text-xs text-gray-500">
                      +{unseenOrders.length - 5} more orders
                    </div>
                  )}
                </>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No new freight orders
                </div>
              )}
            </div>

            {/* Footer */}
            {unseenOrders.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={clearAllNotifications}
                  className="text-xs text-gray-600 hover:text-gray-900"
                >
                  Clear all
                </button>
                <button
                  onClick={() => {
                    router.push('/freight-orders');
                    setShowDropdown(false);
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  View all orders →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        .animate-pulse-subtle {
          animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
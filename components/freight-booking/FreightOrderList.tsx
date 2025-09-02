"use client";

import { Button, Card } from "flowbite-react";
import { useState } from "react";
import { HiClock, HiDatabase, HiRefresh, HiTrash } from "react-icons/hi";
import { FreightOrderSkeleton } from "./FreightOrderSkeleton";

interface FreightReadyOrder {
  orderNumber: string;
  orderDate: string;
  customerName: string;
  itemCount: number;
  orderId: number;
  customerEmail: string;
  orderTotal: number;
  internalNotes: string | null;
  customerNotes: string | null;
}

interface OrderMetadata {
  totalOrdersFetched: number;
  totalFreightReady: number;
  timestamp: string;
  pagesFetched: number;
  cached: boolean;
}

interface FreightOrderListProps {
  orders: FreightReadyOrder[];
  onOrderSelect: (orderNumber: string) => Promise<void>;
  onRefresh: (forceRefresh?: boolean) => Promise<void>;
  onClearCache?: () => Promise<void>;
  isLoading: boolean;
  metadata?: OrderMetadata | null;
}

export default function FreightOrderList({
  orders,
  onOrderSelect,
  onRefresh,
  onClearCache,
  isLoading,
  metadata,
}: FreightOrderListProps) {
  const [selectingOrder, setSelectingOrder] = useState<string | null>(null);

  const handleOrderClick = async (orderNumber: string) => {
    setSelectingOrder(orderNumber);

    try {
      await onOrderSelect(orderNumber);
    } catch (error) {
      console.error("Error selecting order:", error);
    } finally {
      setSelectingOrder(null);
    }
  };

  return (
    <Card className="mt-4 w-full md:max-w-screen-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Freight Ready Orders
          </h3>
          {metadata && (
            <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center">
                <HiDatabase className="mr-1 h-3 w-3" />
                {metadata.totalFreightReady} of {metadata.totalOrdersFetched}{" "}
                orders
              </span>
              <span>
                {metadata.pagesFetched} page
                {metadata.pagesFetched !== 1 ? "s" : ""}
              </span>
              <span
                className={metadata.cached ? "text-green-600" : "text-blue-600"}
              >
                {metadata.cached ? "📋 Cached" : "🔄 Fresh"}
              </span>
              <span>{new Date(metadata.timestamp).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            color="light"
            onClick={() => onRefresh(false)}
            disabled={isLoading}
            className="transition-all duration-200 hover:shadow-sm"
          >
            <HiClock className="mr-2 h-4 w-4" />
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
          <Button
            size="sm"
            color="blue"
            onClick={() => onRefresh(true)}
            disabled={isLoading}
            className="transition-all duration-200 hover:shadow-sm"
          >
            <HiRefresh className="mr-2 h-4 w-4" />
            Force
          </Button>
          {onClearCache && metadata?.cached && (
            <Button
              size="sm"
              color="failure"
              onClick={onClearCache}
              disabled={isLoading}
              className="transition-all duration-200 hover:shadow-sm"
              title="Clear stale cache data"
            >
              <HiTrash className="mr-2 h-4 w-4" />
              Clear Cache
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? // Show skeleton loading state
            Array.from({ length: 6 }).map((_, index) => (
              <FreightOrderSkeleton key={index} />
            ))
          : orders.map((order) => (
              <Card
                key={order.orderNumber}
                className={`cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:shadow-md dark:hover:bg-gray-700 ${
                  selectingOrder === order.orderNumber
                    ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30"
                    : "hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                onClick={() => handleOrderClick(order.orderNumber)}
              >
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      Order #{order.orderNumber}
                    </span>
                    {selectingOrder === order.orderNumber && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    )}
                  </div>

                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {order.customerName}
                  </span>

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {new Date(order.orderDate).toLocaleDateString()}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {order.itemCount} items
                    </span>
                  </div>

                  {order.orderTotal && (
                    <div className="text-right">
                      <span className="font-medium text-green-600 dark:text-green-400">
                        ${order.orderTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            ))}

        {orders.length === 0 && !isLoading && (
          <div className="col-span-full rounded-lg bg-gray-50 p-8 text-center dark:bg-gray-800/50">
            <div className="text-gray-500 dark:text-gray-400">
              <HiClock className="mx-auto mb-2 h-8 w-8" />
              <p className="font-medium">No freight ready orders available</p>
              <p className="text-sm">
                Orders marked as "Freight Order Ready" will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

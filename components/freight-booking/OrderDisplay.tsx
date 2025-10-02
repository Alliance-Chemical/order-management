import Link from "next/link";
import {
  HiOutlineCalendar,
  HiOutlineIdentification,
  HiOutlinePhotograph,
  HiOutlineShoppingCart,
  HiOutlineTag,
  HiExclamation,
  HiCheckCircle,
} from "react-icons/hi";
import type { ShipStationOrder } from "@/types/freight-booking";

const OrderDisplay = ({
  order,
  skusWithNoClassification = [],
}: {
  order: ShipStationOrder;
  skusWithNoClassification?: string[];
}) => {
  const hasUnlinkedSKUs = order.items?.some((item: any) =>
    item.sku && skusWithNoClassification.includes(item.sku)
  );

  return (
    <div className="animate-fadeIn space-y-8">
      {/* Warning Banner for Unlinked SKUs */}
      {hasUnlinkedSKUs && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <HiExclamation className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                Classification Required - Cannot Ship Without Proper Hazmat Documentation
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                <p>The following SKUs need freight classification before this order can be shipped:</p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {order.items
                    ?.filter((item: any) => item.sku && skusWithNoClassification.includes(item.sku))
                    .map((item: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-medium">{item.sku}</span> - {item.name}
                        <Link
                          href={`/link?query=${item.sku}`}
                          className="ml-2 text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          target="_blank"
                        >
                          Fix Now →
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
              <div className="mt-4">
                <Link
                  href="/link"
                  className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                >
                  <HiExclamation className="mr-2 h-4 w-4" />
                  Go to Classification Page
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Header */}
      <div className="dark:to-gray-750 flex flex-col space-y-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm dark:from-gray-800 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center">
          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <HiOutlineShoppingCart className="text-xl text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Order{" "}
            <span className="text-blue-600 dark:text-blue-400">
              #{order.orderNumber}
            </span>
          </h2>
        </div>
        <div className="flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          <HiOutlineCalendar className="mr-2 text-blue-500 dark:text-blue-400" />
          <span>
            {new Date(order.orderDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Item List */}
      <div className="space-y-4">
        {order.items?.map((item: any, index: number) => (
          <div
            key={index}
            className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:translate-y-[-2px] hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex flex-col p-4 sm:flex-row sm:items-center sm:space-x-5">
              {/* Improved product icon */}
              <div className="mb-3 self-center transition-transform duration-200 group-hover:scale-105 sm:mb-0">
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 dark:border-gray-600 dark:from-gray-700 dark:to-gray-800">
                  <HiOutlinePhotograph className="h-10 w-10 text-blue-500 dark:text-blue-400" />
                </div>
              </div>

              {/* Product Details */}
              <div className="flex flex-1 flex-col space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-medium text-gray-900 transition-colors duration-200 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                    {item.name}
                  </h3>
                  {/* Classification Status Badge */}
                  {skusWithNoClassification.includes(item.sku) ? (
                    <div className="flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/50 dark:text-red-300">
                      <HiExclamation className="mr-1 h-3.5 w-3.5" />
                      Needs Classification
                    </div>
                  ) : (
                    <div className="flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
                      <HiCheckCircle className="mr-1 h-3.5 w-3.5" />
                      Classified
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <HiOutlineTag className="mr-1.5 text-blue-500 dark:text-blue-400" />
                    {skusWithNoClassification.includes(item.sku) ? (
                      <div className="flex items-center">
                        <span className="font-mono text-red-600 dark:text-red-400">{item.sku}</span>
                        <Link
                          href={`/link?query=${item.sku}`}
                          className="ml-2 text-sm text-red-600 underline transition-colors duration-200 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          target="_blank"
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(`/link?query=${item.sku}`, "_blank");
                          }}
                        >
                          Fix →
                        </Link>
                      </div>
                    ) : (
                      <span className="font-mono">{item.sku}</span>
                    )}
                  </div>

                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <div className="flex items-center rounded-full bg-blue-100 px-2 py-0.5 dark:bg-blue-900">
                      <HiOutlineIdentification className="mr-1.5 text-blue-500 dark:text-blue-400" />
                      <span>
                        Qty:{" "}
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {item.quantity}
                        </span>
                      </span>
                    </div>
                  </div>

                  {item.unitPrice && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <div className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
                        Price:{" "}
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          ${parseFloat(item.unitPrice.toString()).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Total Price (if available) */}
              {item.unitPrice && (
                <div className="mt-3 self-end text-right sm:mt-0">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</div>
                  <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order Summary */}
      {order.orderTotal && (
        <div className="mt-6 flex justify-end">
          <div className="dark:to-gray-750 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 shadow-sm dark:border-gray-700 dark:from-gray-800">
            <div className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
              Order Total
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              ${order.orderTotal.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDisplay;
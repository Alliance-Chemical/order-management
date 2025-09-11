'use client'

import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { OrderItem } from '@/hooks/usePalletBuilder'

interface PalletItemSelectorProps {
  unassignedItems: OrderItem[]
  readOnly: boolean
  onDragStart: (item: OrderItem) => void
  onDragEnd: () => void
}

export function PalletItemSelector({
  unassignedItems,
  readOnly,
  onDragStart,
  onDragEnd
}: PalletItemSelectorProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-300">
      <h4 className="text-xl font-bold text-gray-800 mb-4 uppercase">
        Items to Pack
      </h4>
      
      {unassignedItems.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-2" />
          <p className="text-gray-600">All items assigned!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {unassignedItems.map((item) => (
            <div
              key={item.sku}
              className="bg-white p-4 rounded-lg border-2 border-blue-300 cursor-move hover:shadow-lg transition-shadow"
              draggable={!readOnly}
              onDragStart={() => onDragStart(item)}
              onDragEnd={onDragEnd}
            >
              <div className="font-bold text-lg">{item.name}</div>
              <div className="text-sm text-gray-600">SKU: {item.sku}</div>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-2xl font-bold text-blue-600">
                  QTY: {item.quantity}
                </span>
                {item.weight && (
                  <span className="text-sm text-gray-500">
                    {item.weight.value * item.quantity} {item.weight.units}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
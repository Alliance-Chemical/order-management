'use client'

import { CubeIcon, TrashIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/solid'
import { Button } from '@/components/ui/button'
import StatusLight from '@/components/ui/StatusLight'
import { Pallet, OrderItem, MAX_PALLET_WEIGHT_LBS } from '@/hooks/usePalletBuilder'

interface PalletGridProps {
  pallets: Pallet[]
  selectedPallet: string | null
  draggedItem: OrderItem | null
  showDimensionInput: string | null
  readOnly: boolean
  onSelectPallet: (id: string) => void
  onDeletePallet: (id: string) => void
  onItemDrop: (palletId: string, item: OrderItem) => void
  onRemoveItem: (palletId: string, itemSku: string) => void
  onUpdateDimensions: (palletId: string, dims: Partial<Pallet['dimensions']>) => void
  onShowDimensionInput: (id: string | null) => void
  onCreatePallet: (type: '48x48' | '48x40') => void
  getWeightWarning: (weight: number) => 'danger' | 'warning' | 'success'
}

export function PalletGrid({
  pallets,
  selectedPallet,
  draggedItem,
  showDimensionInput,
  readOnly,
  onSelectPallet,
  onDeletePallet,
  onItemDrop,
  onRemoveItem,
  onUpdateDimensions,
  onShowDimensionInput,
  onCreatePallet,
  getWeightWarning
}: PalletGridProps) {
  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h4 className="text-xl font-bold text-gray-800 uppercase">
          Pallets ({pallets.length})
        </h4>
        {!readOnly && (
          <div className="flex gap-2">
            <Button
              variant="go"
              size="medium"
              onClick={() => onCreatePallet('48x48')}
              icon={<PlusIcon className="h-6 w-6" />}
            >
              48×48
            </Button>
            <Button
              variant="go"
              size="medium"
              onClick={() => onCreatePallet('48x40')}
              icon={<PlusIcon className="h-6 w-6" />}
            >
              48×40
            </Button>
          </div>
        )}
      </div>

      {pallets.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-12 border-2 border-dashed border-gray-400 text-center">
          <CubeIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-xl text-gray-600 mb-4">No pallets created yet</p>
          {!readOnly && (
            <p className="text-lg text-gray-500">
              Click a button above to add a pallet
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pallets.map((pallet) => {
            const weightStatus = getWeightWarning(pallet.weight.value)
            const statusLightStatus = weightStatus === 'danger' ? 'stop' : weightStatus === 'warning' ? 'caution' : 'go'
            const weightBarClass = weightStatus === 'danger'
              ? 'bg-red-500'
              : weightStatus === 'warning'
                ? 'bg-yellow-500'
                : 'bg-green-500'

            return (
              <div
              key={pallet.id}
              className={`bg-white rounded-lg border-4 ${
                selectedPallet === pallet.id ? 'border-blue-500' : 'border-gray-300'
              } p-4 cursor-pointer transition-all hover:shadow-xl`}
              onClick={() => onSelectPallet(pallet.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedItem && !readOnly) {
                  onItemDrop(pallet.id, draggedItem)
                }
              }}
            >
              {/* Pallet Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h5 className="text-lg font-bold text-gray-800">
                    {pallet.type === 'custom' ? 'Custom' : pallet.type} Pallet
                  </h5>
                  <div className="text-sm text-gray-600 mt-1">
                    {pallet.dimensions.length} × {pallet.dimensions.width} × {pallet.dimensions.height || '?'} {pallet.dimensions.units}
                  </div>
                </div>
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeletePallet(pallet.id)
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <TrashIcon className="h-6 w-6" />
                  </button>
                )}
              </div>

              {/* Weight Status */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-600">Weight</span>
                  <StatusLight status={statusLightStatus} />
                </div>
                <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full transition-all ${weightBarClass}`}
                    style={{ width: `${Math.min((pallet.weight.value / MAX_PALLET_WEIGHT_LBS) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {pallet.weight.value.toFixed(0)} / {MAX_PALLET_WEIGHT_LBS} lbs
                </div>
              </div>

              {/* Items on Pallet */}
              <div className="space-y-2">
                {pallet.items.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500">Drop items here</p>
                  </div>
                ) : (
                  pallet.items.map((item) => (
                    <div
                      key={item.sku}
                      className="bg-blue-50 p-3 rounded-lg border-2 border-blue-200 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-sm text-gray-600">
                          QTY: {item.quantity} | SKU: {item.sku}
                        </div>
                      </div>
                      {!readOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveItem(pallet.id, item.sku)
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Edit Dimensions */}
              {!readOnly && showDimensionInput === pallet.id && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="L"
                      defaultValue={pallet.dimensions.length}
                      onChange={(e) => onUpdateDimensions(pallet.id, { length: Number(e.target.value) })}
                      className="px-2 py-1 border rounded text-center"
                    />
                    <input
                      type="number"
                      placeholder="W"
                      defaultValue={pallet.dimensions.width}
                      onChange={(e) => onUpdateDimensions(pallet.id, { width: Number(e.target.value) })}
                      className="px-2 py-1 border rounded text-center"
                    />
                    <input
                      type="number"
                      placeholder="H"
                      defaultValue={pallet.dimensions.height}
                      onChange={(e) => onUpdateDimensions(pallet.id, { height: Number(e.target.value) })}
                      className="px-2 py-1 border rounded text-center"
                    />
                  </div>
                </div>
              )}
              
              {!readOnly && showDimensionInput !== pallet.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onShowDimensionInput(pallet.id)
                  }}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <ArrowsPointingOutIcon className="h-4 w-4 mr-1" />
                  Adjust Dimensions
                </button>
              )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Fix PlusIcon import
import { PlusIcon } from '@heroicons/react/24/solid'

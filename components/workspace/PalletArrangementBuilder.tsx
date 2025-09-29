'use client'

import { CubeIcon } from '@heroicons/react/24/solid'
import { usePalletBuilder, OrderItem, Pallet } from '@/hooks/usePalletBuilder'
import { PalletGrid } from '@/components/pallet/PalletGrid'
import { PalletItemSelector } from '@/components/pallet/PalletItemSelector'
import { PalletSummary } from '@/components/pallet/PalletSummary'

interface PalletArrangementBuilderProps {
  orderItems: OrderItem[]
  existingPallets?: Pallet[]
  onUpdate: (pallets: Pallet[]) => void
  readOnly?: boolean
}

export default function PalletArrangementBuilder({
  orderItems,
  existingPallets = [],
  onUpdate,
  readOnly = false
}: PalletArrangementBuilderProps) {
  const {
    pallets,
    unassignedItems,
    selectedPallet,
    draggedItem,
    showDimensionInput,
    setSelectedPallet,
    setDraggedItem,
    setShowDimensionInput,
    createNewPallet,
    deletePallet,
    handleItemDrop,
    removeItemFromPallet,
    updatePalletDimensions,
    getTotalWeight,
    getWeightWarning
  } = usePalletBuilder({
    orderItems,
    existingPallets,
    onChange: onUpdate
  })

  const unassignedItemCount = unassignedItems.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="bg-white rounded-lg shadow-lg border-2 border-gray-300 p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-warehouse-2xl font-black text-gray-900 flex items-center">
          <CubeIcon className="h-10 w-10 mr-3 text-blue-600" />
          PALLET ARRANGEMENT
        </h3>
        <p className="text-lg text-gray-600 mt-2">
          Drag items to pallets or use buttons to arrange
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unassigned Items Panel */}
        <div className="lg:col-span-1">
          <PalletItemSelector
            unassignedItems={unassignedItems}
            readOnly={readOnly}
            onDragStart={setDraggedItem}
            onDragEnd={() => setDraggedItem(null)}
          />
        </div>

        {/* Pallets Grid */}
        <div className="lg:col-span-2">
          <PalletGrid
            pallets={pallets}
            selectedPallet={selectedPallet}
            draggedItem={draggedItem}
            showDimensionInput={showDimensionInput}
            readOnly={readOnly}
            onSelectPallet={setSelectedPallet}
            onDeletePallet={deletePallet}
            onItemDrop={handleItemDrop}
            onRemoveItem={removeItemFromPallet}
            onUpdateDimensions={updatePalletDimensions}
            onShowDimensionInput={setShowDimensionInput}
            onCreatePallet={createNewPallet}
            getWeightWarning={getWeightWarning}
          />
        </div>
      </div>

      {/* Summary and Actions */}
      <PalletSummary
        palletCount={pallets.length}
        totalWeight={getTotalWeight()}
        unassignedItemCount={unassignedItemCount}
        readOnly={readOnly}
      />
    </div>
  )
}

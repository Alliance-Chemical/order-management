'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { Button } from '@/components/ui/button'

interface PalletSummaryProps {
  palletCount: number
  totalWeight: number
  unassignedItemCount: number
  readOnly: boolean
  saving: boolean
  onSave: () => void
}

export function PalletSummary({
  palletCount,
  totalWeight,
  unassignedItemCount,
  readOnly,
  saving,
  onSave
}: PalletSummaryProps) {
  return (
    <div className="mt-8 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm text-gray-600 uppercase font-semibold">Summary</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {palletCount} Pallet{palletCount !== 1 ? 's' : ''} | {totalWeight.toFixed(0)} lbs Total
          </div>
          {unassignedItemCount > 0 && (
            <div className="text-sm text-orange-600 mt-1 flex items-center">
              <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
              {unassignedItemCount} items not assigned
            </div>
          )}
        </div>
        
        {!readOnly && (
          <Button
            variant={unassignedItemCount === 0 ? "go" : "caution"}
            size="large"
            onClick={onSave}
            disabled={saving || palletCount === 0}
            loading={saving}
          >
            {saving ? 'SAVING...' : 'SAVE ARRANGEMENT'}
          </Button>
        )}
      </div>
    </div>
  )
}
'use client'

interface Dimensions {
  length: string
  width: string
  height: string
  units: 'in' | 'cm'
}

interface Weight {
  value: string
  units: 'lbs' | 'kg'
}

interface MeasurementsModalProps {
  isOpen: boolean
  dimensions: Dimensions
  weight: Weight
  savingMeasurements: boolean
  onDimensionsChange: (dimensions: Dimensions) => void
  onWeightChange: (weight: Weight) => void
  onSave: () => void
  onClose: () => void
}

export function MeasurementsModal({
  isOpen,
  dimensions,
  weight,
  savingMeasurements,
  onDimensionsChange,
  onWeightChange,
  onSave,
  onClose
}: MeasurementsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <h3 className="text-xl font-bold mb-4">Record Final Dimensions & Weight</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                inputMode="decimal" 
                value={dimensions.length} 
                onChange={(e) => onDimensionsChange({ ...dimensions, length: e.target.value })} 
                placeholder="L" 
                className="w-20 px-3 py-2 border rounded" 
              />
              <span>x</span>
              <input 
                type="number" 
                inputMode="decimal" 
                value={dimensions.width} 
                onChange={(e) => onDimensionsChange({ ...dimensions, width: e.target.value })} 
                placeholder="W" 
                className="w-20 px-3 py-2 border rounded" 
              />
              <span>x</span>
              <input 
                type="number" 
                inputMode="decimal" 
                value={dimensions.height} 
                onChange={(e) => onDimensionsChange({ ...dimensions, height: e.target.value })} 
                placeholder="H" 
                className="w-20 px-3 py-2 border rounded" 
              />
              <select 
                value={dimensions.units} 
                onChange={(e) => onDimensionsChange({ ...dimensions, units: e.target.value as Dimensions['units'] })} 
                className="px-2 py-2 border rounded"
              >
                <option value="in">in</option>
                <option value="cm">cm</option>
              </select>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                inputMode="decimal" 
                value={weight.value} 
                onChange={(e) => onWeightChange({ ...weight, value: e.target.value })} 
                placeholder="Weight" 
                className="w-32 px-3 py-2 border rounded" 
              />
              <select 
                value={weight.units} 
                onChange={(e) => onWeightChange({ ...weight, units: e.target.value as Weight['units'] })} 
                className="px-2 py-2 border rounded"
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            disabled={savingMeasurements}
            onClick={onSave}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {savingMeasurements ? 'Saving…' : 'Save & Complete'}
          </button>
          <button
            disabled={savingMeasurements}
            onClick={onClose}
            className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

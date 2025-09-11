'use client'

import { Button } from '@/components/ui/button'
import { InspectionItem } from '@/lib/types/agent-view'

interface InspectionFormProps {
  currentItem: InspectionItem
  formData: {
    datePerformed: string
    inspector: string
    packingSlipVerified: boolean
    lotNumbers: string
    coaStatus: string
    productInspection: {
      check_label_info: boolean
      lid_inspection: boolean
      ghs_labels: boolean
    }
    lidPhotos: Array<{ url: string; name: string; timestamp: string }>
    lotNumberPhoto: { url: string; base64?: string; timestamp: string } | null
    extractedLotNumbers: string[]
  }
  orderNumber: string
  workspace?: any
  orderItems?: any[]
  isProcessingLotNumbers: boolean
  onUpdateField: (field: string, value: any) => void
  onUpdateNestedField: (parent: string, field: string, value: any) => void
  onPhotoUpload: (file: File) => void
  onLotNumberPhotoCapture: (file: File) => void
  onExtractLotNumbers: () => void
  onFormStepComplete: (stepId: string) => void
}

export function InspectionForm({
  currentItem,
  formData,
  orderNumber,
  workspace,
  orderItems,
  isProcessingLotNumbers,
  onUpdateField,
  onUpdateNestedField,
  onPhotoUpload,
  onLotNumberPhotoCapture,
  onExtractLotNumbers,
  onFormStepComplete
}: InspectionFormProps) {
  const customerName = workspace?.shipstationData?.shipTo?.name || 'N/A'
  
  if (currentItem.id === 'basic_info') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xl font-bold text-gray-900 mb-2">Order #</label>
            <div className="w-full px-4 py-3 text-xl bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-700">
              {orderNumber}
            </div>
          </div>
          <div>
            <label className="block text-xl font-bold text-gray-900 mb-2">Date Performed *</label>
            <input
              type="date"
              value={formData.datePerformed}
              onChange={(e) => onUpdateField('datePerformed', e.target.value)}
              className="w-full px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xl font-bold text-gray-900 mb-2">Inspector *</label>
            <input
              type="text"
              value={formData.inspector}
              onChange={(e) => onUpdateField('inspector', e.target.value)}
              placeholder="Enter inspector name"
              className="w-full px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <Button
          onClick={() => onFormStepComplete('basic_info')}
          variant="go"
          size="xlarge"
          fullWidth
          haptic="success"
        >
          <span className="text-2xl">Continue</span>
        </Button>
      </div>
    )
  }

  if (currentItem.id === 'packing_slip') {
    return (
      <div className="space-y-4">
        {/* Order Details Display */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h3 className="text-xl font-bold text-gray-900 mb-3">Expected Order Details</h3>
          <div className="space-y-2 text-lg">
            <div><strong>Ship To:</strong> {customerName}</div>
            <div><strong>Company:</strong> {workspace?.shipstationData?.shipTo?.company || 'N/A'}</div>
            <div><strong>Address:</strong> {workspace?.shipstationData?.shipTo?.street1 || 'N/A'}, {workspace?.shipstationData?.shipTo?.city || 'N/A'}, {workspace?.shipstationData?.shipTo?.state || 'N/A'} {workspace?.shipstationData?.shipTo?.postalCode || 'N/A'}</div>
            <div><strong>Order #:</strong> {orderNumber}</div>
            <div><strong>P.O. Number:</strong> {workspace?.shipstationData?.customerReference || 'N/A'}</div>
          </div>
        </div>
        
        {/* Items List */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-lg font-bold text-gray-900 mb-3">Order Items</h4>
          <div className="space-y-2">
            {orderItems?.map((item, index) => (
              <div key={index} className="bg-white rounded p-3 text-base">
                <div><strong>{item.quantity}x</strong> {item.name}</div>
                <div className="text-gray-600">SKU: {item.sku}</div>
              </div>
            )) || (
              <div className="text-gray-600">No items available</div>
            )}
          </div>
        </div>
        
        {/* Verification */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={formData.packingSlipVerified}
              onChange={(e) => onUpdateField('packingSlipVerified', e.target.checked)}
              className="w-8 h-8 mt-1 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0"
            />
            <div className="ml-4">
              <div className="text-xl font-bold text-gray-900">Physical packing slip matches the order details shown above?</div>
              <div className="text-base text-gray-700 mt-1">Compare the physical packing slip to the expected order details displayed above</div>
            </div>
          </label>
        </div>
        
        <Button
          onClick={() => onFormStepComplete('packing_slip')}
          variant="go"
          size="xlarge"
          fullWidth
          haptic="success"
        >
          <span className="text-2xl">Continue</span>
        </Button>
      </div>
    )
  }

  if (currentItem.id === 'lot_numbers') {
    return (
      <div className="space-y-4">
        {/* Photo Capture Section */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-3">AI Lot Number Extraction</h3>
          <p className="text-sm text-gray-700 mb-4">
            Take a photo of the container label to automatically extract lot numbers
          </p>
          
          {!formData.lotNumberPhoto ? (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:border-blue-400 bg-blue-25">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => e.target.files?.[0] && onLotNumberPhotoCapture(e.target.files[0])}
                className="sr-only"
              />
              <div className="text-center">
                <svg className="mx-auto w-12 h-12 text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-lg font-medium text-blue-700">Take Photo of Label</span>
              </div>
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <img 
                  src={formData.lotNumberPhoto.url} 
                  alt="Container label"
                  className="w-full max-h-48 object-cover rounded-lg"
                />
                <button
                  onClick={() => onUpdateField('lotNumberPhoto', null)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
              
              {formData.extractedLotNumbers.length === 0 ? (
                <Button
                  onClick={onExtractLotNumbers}
                  disabled={isProcessingLotNumbers}
                  variant="info"
                  size="large"
                  fullWidth
                  loading={isProcessingLotNumbers}
                >
                  <span className="text-lg">
                    {isProcessingLotNumbers ? 'Extracting...' : 'Extract Lot Numbers'}
                  </span>
                </Button>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800 mb-2">Extracted Lot Numbers:</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.extractedLotNumbers.map((lot, index) => (
                      <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-mono">
                        {lot}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual Entry */}
        <div>
          <label className="block text-xl font-bold text-gray-900 mb-2">Lot Numbers *</label>
          <input
            type="text"
            value={formData.lotNumbers}
            onChange={(e) => onUpdateField('lotNumbers', e.target.value)}
            placeholder="Enter or capture lot numbers"
            className="w-full px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-600 mt-1">
            Separate multiple lot numbers with commas
          </p>
        </div>
        
        <Button
          onClick={() => onFormStepComplete('lot_numbers')}
          variant="go"
          size="xlarge"
          fullWidth
          haptic="success"
        >
          <span className="text-2xl">Continue</span>
        </Button>
      </div>
    )
  }

  if (currentItem.id === 'coa_status') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xl font-bold text-gray-900 mb-2">C of A's Status *</label>
          <select
            value={formData.coaStatus}
            onChange={(e) => onUpdateField('coaStatus', e.target.value)}
            className="w-full px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select status</option>
            <option value="match">Match</option>
            <option value="no_coas_needed">No C of A's needed</option>
          </select>
        </div>
        <Button
          onClick={() => onFormStepComplete('coa_status')}
          variant="go"
          size="xlarge"
          fullWidth
          haptic="success"
        >
          <span className="text-2xl">Continue</span>
        </Button>
      </div>
    )
  }

  if (currentItem.id === 'product_inspection') {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          {[
            { id: 'check_label_info', label: 'Check label information (ACS / Tech / UN # / PG)' },
            { id: 'lid_inspection', label: 'Lid (Bleach, Hydrogen Peroxide, Ammonium)' },
            { id: 'ghs_labels', label: 'GHS Labels' }
          ].map((item) => (
            <label key={item.id} className="flex items-center cursor-pointer p-2 bg-white rounded-lg">
              <input
                type="checkbox"
                checked={formData.productInspection[item.id as keyof typeof formData.productInspection]}
                onChange={(e) => onUpdateNestedField('productInspection', item.id, e.target.checked)}
                className="w-6 h-6 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-3 text-lg font-medium text-gray-900">{item.label}</span>
            </label>
          ))}
        </div>
        
        {formData.productInspection.lid_inspection && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Lid Verification Photos Required</h3>
            <p className="text-sm text-gray-700 mb-4">
              Take photos to verify that lids are clean and properly secured.
            </p>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {formData.lidPhotos.map((photo, index) => (
                <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    Lid {index + 1}
                  </div>
                </div>
              ))}
              
              <label className="relative aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer flex items-center justify-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && onPhotoUpload(e.target.files[0])}
                  className="sr-only"
                />
                <div className="text-center">
                  <svg className="mx-auto w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="mt-2 block text-xs text-gray-500">Add Photo</span>
                </div>
              </label>
            </div>
          </div>
        )}
        
        <Button
          onClick={() => onFormStepComplete('product_inspection')}
          variant="go"
          size="xlarge"
          fullWidth
          haptic="success"
        >
          <span className="text-2xl">Continue</span>
        </Button>
      </div>
    )
  }

  return null
}
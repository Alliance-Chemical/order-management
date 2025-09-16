'use client'

import React from 'react'
import { useInspection } from '@/hooks/useInspection'
import { ValidatedQRScanner } from '@/components/qr/ValidatedQRScanner'
import IssueModal from './IssueModal'
import { InspectionItem } from '@/lib/types/agent-view'
import { InspectionHeader } from '@/components/inspection/InspectionHeader'
import { Button } from '@/components/ui/button'

interface ResilientInspectionScreenProps {
  orderId: string
  orderNumber: string
  customerName: string
  orderItems: any[]
  workflowPhase: string
  workflowType: string
  items: InspectionItem[]
  workspace?: any
  onComplete: (results: Record<string, 'pass' | 'fail'>, notes: Record<string, string>) => void
  onSwitchToSupervisor: () => void
}

export default function ResilientInspectionScreen(props: ResilientInspectionScreenProps) {
  const {
    orderId,
    orderNumber,
    customerName,
    orderItems,
    workflowPhase,
    items,
    workspace,
    onComplete,
    onSwitchToSupervisor
  } = props

  // Use the custom hook for all inspection logic
  const inspection = useInspection({
    orderId,
    orderNumber,
    workflowPhase,
    items,
    onComplete
  })

  // Destructure frequently used values from the inspection hook to match JSX usage
  const {
    currentItem,
    formData,
    updateFormField,
    updateNestedField,
    showScanner,
    setShowScanner,
    getExpectedQRType,
    handleQRScan,
    handleSkipQRScan,
    issueModalOpen,
    currentFailedItem,
    setIssueModalOpen,
    handleIssueSubmit,
    requiresQRScan,
    handleFormStepComplete,
    handleResult,
    handlePhotoUpload,
    handleLotNumberPhotoCapture,
    extractLotNumbersFromPhoto,
    isProcessingLotNumbers,
    showMeasurementsModal,
    setShowMeasurementsModal,
    savingMeasurements,
    measurements,
    setMeasurements,
    saveFinalMeasurements,
  } = inspection

  // Local helpers to work with measurements in the existing JSX shape
  const dims = measurements.dimensions
  const wgt = measurements.weight
  const setDims = (newDims: typeof measurements.dimensions) =>
    setMeasurements({ ...measurements, dimensions: newDims })
  const setWgt = (newWgt: typeof measurements.weight) =>
    setMeasurements({ ...measurements, weight: newWgt })

  if (!currentItem) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-white">
      <InspectionHeader
        orderNumber={orderNumber}
        customerName={customerName}
        currentIndex={inspection.currentIndex}
        totalItems={items.length}
        progress={inspection.progress}
        networkStatus={inspection.networkStatus}
        queueLength={inspection.queueStatus.queueLength}
        canUndo={inspection.canUndo}
        onBack={inspection.previousStep}
        onUndo={inspection.undo}
        onSwitchToSupervisor={onSwitchToSupervisor}
      />

      {/* Step Navigation */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {items.map((item, idx) => {
            const isCompleted = inspection.isStepCompleted(item.id)
            const isCurrent = idx === inspection.currentIndex
            const result = inspection.results[item.id]
            
            return (
              <button
                key={item.id}
                onClick={() => inspection.goToStep(idx)}
                className={`
                  px-3 py-1 rounded-lg text-sm whitespace-nowrap
                  ${isCurrent ? 'bg-blue-600 text-white' : ''}
                  ${isCompleted && result === 'pass' ? 'bg-green-100 text-green-800' : ''}
                  ${isCompleted && result === 'fail' ? 'bg-red-100 text-red-800' : ''}
                  ${!isCurrent && !isCompleted ? 'bg-gray-200 text-gray-600' : ''}
                `}
              >
                {idx + 1}. {item.description.substring(0, 20)}...
              </button>
            )
          })}
        </div>
      </div>

      {/* Current Step */}
      <div className="p-6">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-2">{currentItem.description}</h2>
          
          {currentItem.details && (
            <ul className="mt-4 space-y-2">
              {currentItem.details.map((detail, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span className="text-gray-700">{detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Form Fields or Action Buttons */}
        {currentItem.id === 'basic_info' ? (
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
                  onChange={(e) => updateFormField('datePerformed', e.target.value)}
                  className="w-full px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xl font-bold text-gray-900 mb-2">Inspector *</label>
                <input
                  type="text"
                  value={formData.inspector}
                  onChange={(e) => updateFormField('inspector', e.target.value)}
                  placeholder="Enter inspector name"
                  className="w-full px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <Button
              onClick={() => handleFormStepComplete('basic_info')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
            >
              <span className="text-2xl">Continue</span>
            </Button>
          </div>
        ) : currentItem.id === 'packing_slip' ? (
          <div className="space-y-4">
            {/* Order Details Display */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Expected Order Details</h3>
              <div className="space-y-2 text-lg">
                <div><strong>Ship To:</strong> {workspace?.shipstationData?.shipTo?.name || customerName}</div>
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
                  onChange={(e) => updateFormField('packingSlipVerified', e.target.checked)}
                  className="w-8 h-8 mt-1 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0"
                />
                <div className="ml-4">
                  <div className="text-xl font-bold text-gray-900">Physical packing slip matches the order details shown above?</div>
                  <div className="text-base text-gray-700 mt-1">Compare the physical packing slip to the expected order details displayed above</div>
                </div>
              </label>
            </div>
            
            <Button
              onClick={() => handleFormStepComplete('packing_slip')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
            >
              <span className="text-2xl">Continue</span>
            </Button>
          </div>
        ) : currentItem.id === 'lot_numbers' ? (
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
                    onChange={(e) => e.target.files?.[0] && handleLotNumberPhotoCapture(e.target.files[0])}
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
                      onClick={() => {
                        updateFormField('lotNumberPhoto', null);
                        updateFormField('extractedLotNumbers', []);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {formData.extractedLotNumbers.length === 0 ? (
                    <Button
                      onClick={extractLotNumbersFromPhoto}
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
                onChange={(e) => updateFormField('lotNumbers', e.target.value)}
                placeholder="Enter or capture lot numbers"
                className="w-full px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                Separate multiple lot numbers with commas
              </p>
            </div>
            
            <Button
              onClick={() => handleFormStepComplete('lot_numbers')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
            >
              <span className="text-2xl">Continue</span>
            </Button>
          </div>
        ) : currentItem.id === 'product_inspection' ? (
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
                    checked={formData.productInspection[item.id]}
                    onChange={(e) => updateNestedField('productInspection', item.id, e.target.checked)}
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
                      onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
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
              onClick={() => handleFormStepComplete('product_inspection')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
            >
              <span className="text-2xl">Continue</span>
            </Button>
          </div>
        ) : requiresQRScan ? (
          <div className="space-y-4">
            <Button
              onClick={() => setShowScanner(true)}
              variant="info"
              size="xlarge"
              fullWidth
              haptic="light"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            >
              <span className="text-2xl">Scan QR Code</span>
            </Button>
            
            <Button
              onClick={() => {
                const reason = prompt('Why are you skipping the QR scan?');
                if (reason && reason.trim()) {
                  handleSkipQRScan(reason.trim());
                }
              }}
              variant="neutral"
              size="large"
              fullWidth
            >
              Skip QR Scan
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleResult('pass')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              }
            >
              <span className="text-2xl">Pass</span>
            </Button>
            
            <Button
              onClick={() => handleResult('fail')}
              variant="stop"
              size="xlarge"
              fullWidth
              haptic="error"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              }
            >
              <span className="text-2xl">Fail</span>
            </Button>
          </div>
        )}
      </div>

      {/* QR Scanner */}
      {showScanner && (
        <ValidatedQRScanner
          expectedType={getExpectedQRType()}
          orderId={orderId}
          onValidScan={handleQRScan}
          onClose={() => setShowScanner(false)}
          allowManualEntry={true}
          allowSkip={false}
          supervisorMode={false}
        />
      )}

      {/* Issue Modal */}
      {issueModalOpen && currentFailedItem && (
        <IssueModal
          item={currentFailedItem}
          onSubmit={handleIssueSubmit}
          onClose={() => setIssueModalOpen(false)}
        />
      )}


      {showMeasurementsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-xl font-bold mb-4">Record Final Dimensions & Weight</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions</label>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" value={dims.length} onChange={(e) => setDims({ ...dims, length: e.target.value })} placeholder="L" className="w-20 px-3 py-2 border rounded" />
                  <span>x</span>
                  <input type="number" inputMode="decimal" value={dims.width} onChange={(e) => setDims({ ...dims, width: e.target.value })} placeholder="W" className="w-20 px-3 py-2 border rounded" />
                  <span>x</span>
                  <input type="number" inputMode="decimal" value={dims.height} onChange={(e) => setDims({ ...dims, height: e.target.value })} placeholder="H" className="w-20 px-3 py-2 border rounded" />
                  <select value={dims.units} onChange={(e) => setDims({ ...dims, units: e.target.value })} className="px-2 py-2 border rounded">
                    <option value="in">in</option>
                    <option value="cm">cm</option>
                  </select>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" value={wgt.value} onChange={(e) => setWgt({ ...wgt, value: e.target.value })} placeholder="Weight" className="w-32 px-3 py-2 border rounded" />
                  <select value={wgt.units} onChange={(e) => setWgt({ ...wgt, units: e.target.value })} className="px-2 py-2 border rounded">
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                disabled={savingMeasurements}
                onClick={saveFinalMeasurements}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {savingMeasurements ? 'Saving…' : 'Save & Complete'}
              </button>
              <button
                disabled={savingMeasurements}
                onClick={() => setShowMeasurementsModal(false)}
                className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

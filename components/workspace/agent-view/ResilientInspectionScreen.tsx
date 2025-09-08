'use client';

import React, { useState, useEffect } from 'react';
import { useInspectionState } from '@/hooks/useInspectionState';
import { ValidatedQRScanner } from '@/components/qr/ValidatedQRScanner';
import { inspectionQueue } from '@/lib/services/offline/inspection-queue';
import IssueModal from './IssueModal';
import { InspectionItem } from '@/lib/types/agent-view';
import { QRType } from '@/lib/services/qr/validation';
import WarehouseButton from '@/components/ui/WarehouseButton';
import ProgressBar from '@/components/ui/ProgressBar';
import StatusLight from '@/components/ui/StatusLight';

interface ResilientInspectionScreenProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  orderItems: any[];
  workflowPhase: string;
  workflowType: string;
  items: InspectionItem[];
  workspace?: any; // Add workspace data for full order details
  onComplete: (results: Record<string, 'pass' | 'fail'>, notes: Record<string, string>) => void;
  onSwitchToSupervisor: () => void;
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
  } = props;

  // Use the inspection state hook for persistence and recovery
  const {
    currentIndex,
    currentItem,
    results,
    notes,
    scannedQRs,
    progress,
    isRestored,
    canUndo,
    goToStep,
    nextStep,
    previousStep,
    recordResult,
    recordQRScan,
    undo,
    clearState,
    isStepCompleted
  } = useInspectionState({
    orderId,
    workflowPhase,
    items,
    onComplete: (r, n) => {
      // Intercept completion to collect final dims/weight
      setPendingCompletion({ results: r, notes: n });
      setShowMeasurementsModal(true);
    },
    enablePersistence: true
  });

  const [showScanner, setShowScanner] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [currentFailedItem, setCurrentFailedItem] = useState<InspectionItem | null>(null);
  const [networkStatus, setNetworkStatus] = useState(navigator.onLine);
  const [queueStatus, setQueueStatus] = useState(inspectionQueue.getStatus());
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState<{ results: Record<string, 'pass' | 'fail'>; notes: Record<string, string>; } | null>(null);
  const [dims, setDims] = useState({ length: '', width: '', height: '', units: 'in' });
  const [wgt, setWgt] = useState({ value: '', units: 'lbs' });
  const [savingMeasurements, setSavingMeasurements] = useState(false);

  // Form data for new workflow fields
  const [formData, setFormData] = useState({
    datePerformed: new Date().toISOString().split('T')[0],
    inspector: '',
    packingSlipVerified: false,
    lotNumbers: '',
    coaStatus: '',
    productInspection: {
      check_label_info: false,
      lid_inspection: false,
      ghs_labels: false
    },
    lidPhotos: [],
    lotNumberPhoto: null,
    extractedLotNumbers: []
  });

  const [isProcessingLotNumbers, setIsProcessingLotNumbers] = useState(false);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(true);
      inspectionQueue.retryFailed();
    };
    
    const handleOffline = () => {
      setNetworkStatus(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update queue status periodically
    const interval = setInterval(() => {
      setQueueStatus(inspectionQueue.getStatus());
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Show restoration message
  useEffect(() => {
    if (isRestored) {
      const message = document.createElement('div');
      message.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      message.textContent = 'Inspection progress restored';
      document.body.appendChild(message);
      
      setTimeout(() => {
        message.remove();
      }, 3000);
    }
  }, [isRestored]);

  // Determine expected QR type
  const getExpectedQRType = (): QRType | undefined => {
    if (!currentItem) return undefined;
    
    if (currentItem.id === 'scan_destination_qr') return 'destination';
    if (currentItem.id === 'scan_master_label') return 'order_master';
    
    return undefined;
  };

  // Handle QR scan
  const handleQRScan = (data: any, shortCode?: string) => {
    if (data) {
      // Valid QR scanned
      recordQRScan(currentItem.id, shortCode || JSON.stringify(data));
      recordResult(currentItem.id, 'pass');
      
      // Queue for server sync
      inspectionQueue.enqueue({
        type: 'qr_scan',
        orderId,
        data: {
          stepId: currentItem.id,
          qrData: data,
          shortCode,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    setShowScanner(false);
    nextStep();
  };

  // Handle skipping QR scan with logging
  const handleSkipQRScan = (reason: string) => {
    recordResult(currentItem.id, 'pass', `QR scan skipped: ${reason}`);
    
    // Log skip for audit trail
    inspectionQueue.enqueue({
      type: 'qr_skip',
      orderId,
      data: {
        stepId: currentItem.id,
        reason,
        timestamp: new Date().toISOString()
      }
    });
    
    setShowScanner(false);
    nextStep();
  };

  // Form handling functions
  const updateFormField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedField = (parent: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const handlePhotoUpload = async (file: File) => {
    const photoUrl = URL.createObjectURL(file);
    const newPhoto = { url: photoUrl, name: file.name, timestamp: new Date().toISOString() };
    setFormData(prev => ({
      ...prev,
      lidPhotos: [...prev.lidPhotos, newPhoto]
    }));
  };

  const validateFormStep = (stepId: string): boolean => {
    switch (stepId) {
      case 'basic_info':
        return !!(formData.datePerformed && formData.inspector);
      case 'packing_slip':
        return formData.packingSlipVerified;
      case 'lot_numbers':
        return !!formData.lotNumbers.trim();
      case 'coa_status':
        return !!formData.coaStatus;
      case 'product_inspection':
        const hasSelection = Object.values(formData.productInspection).some(Boolean);
        const hasLidPhotos = !formData.productInspection.lid_inspection || formData.lidPhotos.length > 0;
        return hasSelection && hasLidPhotos;
      default:
        return true;
    }
  };

  const handleFormStepComplete = (stepId: string) => {
    if (validateFormStep(stepId)) {
      recordResult(stepId, 'pass', JSON.stringify(formData));
      nextStep();
    } else {
      alert('Please complete all required fields before continuing.');
    }
  };

  const handleLotNumberPhotoCapture = async (file: File) => {
    const photoUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setFormData(prev => ({
        ...prev,
        lotNumberPhoto: { url: photoUrl, base64, timestamp: new Date().toISOString() }
      }));
    };
    
    reader.readAsDataURL(file);
  };

  const extractLotNumbersFromPhoto = async () => {
    if (!formData.lotNumberPhoto?.base64) return;
    
    setIsProcessingLotNumbers(true);
    try {
      const response = await fetch('/api/ai/extract-lot-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: formData.lotNumberPhoto.base64,
          orderId 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const extractedNumbers = data.lotNumbers || [];
        
        setFormData(prev => ({
          ...prev,
          extractedLotNumbers: extractedNumbers,
          lotNumbers: extractedNumbers.join(', ') // Auto-populate the text field
        }));
      } else {
        console.error('Failed to extract lot numbers');
        alert('Failed to extract lot numbers. Please try again or enter manually.');
      }
    } catch (error) {
      console.error('Error extracting lot numbers:', error);
      alert('Error extracting lot numbers. Please try again or enter manually.');
    } finally {
      setIsProcessingLotNumbers(false);
    }
  };

  // Handle pass/fail buttons
  const handleResult = (result: 'pass' | 'fail') => {
    if (result === 'fail') {
      setCurrentFailedItem(currentItem);
      setIssueModalOpen(true);
    } else {
      recordResult(currentItem.id, 'pass');
      
      // Queue for server sync
      inspectionQueue.enqueue({
        type: 'inspection_result',
        orderId,
        phase: workflowPhase,
        data: {
          stepId: currentItem.id,
          result: 'pass',
          timestamp: new Date().toISOString(),
          phase: workflowPhase
        }
      });
      
      nextStep();
    }
  };

  // Handle issue submission
  const handleIssueSubmit = (issue: string) => {
    if (currentFailedItem) {
      recordResult(currentFailedItem.id, 'fail', issue);
      
      // Queue for server sync
      inspectionQueue.enqueue({
        type: 'inspection_result',
        orderId,
        phase: workflowPhase,
        data: {
          stepId: currentFailedItem.id,
          result: 'fail',
          issue,
          phase: workflowPhase,
          timestamp: new Date().toISOString()
        }
      });
      
      setCurrentFailedItem(null);
    }
    
    setIssueModalOpen(false);
    nextStep();
  };


  // Check if current item requires QR scanning
  const requiresQRScan = currentItem && (
    currentItem.id === 'scan_destination_qr' ||
    currentItem.id === 'scan_master_label'
  );

  if (!currentItem) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Network Status Bar */}
      {!networkStatus && (
        <div className="bg-yellow-500 text-white px-4 py-2 flex items-center justify-center gap-3">
          <StatusLight status="caution" size="base" />
          <span>
            <span className="font-semibold">Offline Mode</span> - Changes will sync when connection restored
            {queueStatus.queueLength > 0 && (
              <span className="ml-2">({queueStatus.queueLength} pending)</span>
            )}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center mb-2">
          <WarehouseButton
            onClick={previousStep}
            disabled={currentIndex === 0}
            variant="neutral"
            size="base"
          >
            ← Back
          </WarehouseButton>
          
          <div className="flex gap-2">
            {canUndo && (
              <WarehouseButton
                onClick={undo}
                variant="info"
                size="base"
              >
                Undo
              </WarehouseButton>
            )}
            
            <WarehouseButton
              onClick={onSwitchToSupervisor}
              variant="info"
              size="base"
            >
              Supervisor View
            </WarehouseButton>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold">Order #{orderNumber}</h1>
        <p className="text-blue-100">{customerName}</p>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <ProgressBar
            value={progress}
            label={`Step ${currentIndex + 1} of ${items.length}`}
            showPercentage={true}
            variant="default"
            animated={true}
          />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {items.map((item, idx) => {
            const isCompleted = isStepCompleted(item.id);
            const isCurrent = idx === currentIndex;
            const result = results[item.id];
            
            return (
              <button
                key={item.id}
                onClick={() => goToStep(idx)}
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
            );
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
            <WarehouseButton
              onClick={() => handleFormStepComplete('basic_info')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
            >
              <span className="text-2xl">Continue</span>
            </WarehouseButton>
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
            
            <WarehouseButton
              onClick={() => handleFormStepComplete('packing_slip')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
            >
              <span className="text-2xl">Continue</span>
            </WarehouseButton>
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
                      onClick={() => setFormData(prev => ({ ...prev, lotNumberPhoto: null, extractedLotNumbers: [] }))}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {formData.extractedLotNumbers.length === 0 ? (
                    <WarehouseButton
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
                    </WarehouseButton>
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
            
            <WarehouseButton
              onClick={() => handleFormStepComplete('lot_numbers')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
            >
              <span className="text-2xl">Continue</span>
            </WarehouseButton>
          </div>
        ) : currentItem.id === 'coa_status' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xl font-bold text-gray-900 mb-2">C of A's Status *</label>
              <select
                value={formData.coaStatus}
                onChange={(e) => updateFormField('coaStatus', e.target.value)}
                className="w-full px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select status</option>
                <option value="match">Match</option>
                <option value="no_coas_needed">No C of A's needed</option>
              </select>
            </div>
            <WarehouseButton
              onClick={() => handleFormStepComplete('coa_status')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
            >
              <span className="text-2xl">Continue</span>
            </WarehouseButton>
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
            
            <WarehouseButton
              onClick={() => handleFormStepComplete('product_inspection')}
              variant="go"
              size="xlarge"
              fullWidth
              haptic="success"
            >
              <span className="text-2xl">Continue</span>
            </WarehouseButton>
          </div>
        ) : requiresQRScan ? (
          <div className="space-y-4">
            <WarehouseButton
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
            </WarehouseButton>
            
            <WarehouseButton
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
            </WarehouseButton>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <WarehouseButton
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
            </WarehouseButton>
            
            <WarehouseButton
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
            </WarehouseButton>
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
                onClick={async () => {
                  if (!pendingCompletion) return;
                  if (!dims.length || !dims.width || !dims.height || !wgt.value) {
                    alert('Please enter all dimensions and weight.');
                    return;
                  }
                  try {
                    setSavingMeasurements(true);
                    await fetch(`/api/workspaces/${orderId}/final-measurements`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        dimensions: {
                          length: Number(dims.length),
                          width: Number(dims.width),
                          height: Number(dims.height),
                          units: dims.units,
                        },
                        weight: {
                          value: Number(wgt.value),
                          units: wgt.units,
                        },
                      }),
                    });
                  } catch (e) {
                    console.error('Failed to save measurements', e);
                  } finally {
                    setSavingMeasurements(false);
                  }
                  onComplete(pendingCompletion.results, pendingCompletion.notes);
                  setShowMeasurementsModal(false);
                }}
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
  );
}

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

        {/* Action Buttons */}
        {requiresQRScan ? (
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

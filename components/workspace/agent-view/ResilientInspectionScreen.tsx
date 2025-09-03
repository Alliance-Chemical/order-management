'use client';

import React, { useState, useEffect } from 'react';
import { useInspectionState } from '@/hooks/useInspectionState';
import { ValidatedQRScanner } from '@/components/qr/ValidatedQRScanner';
import { inspectionQueue } from '@/lib/services/offline/inspection-queue';
import { supervisorOverride } from '@/lib/services/supervisor-override';
import IssueModal from './IssueModal';
import { InspectionItem } from '@/lib/types/agent-view';
import { QRType } from '@/lib/services/qr/validation';

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
    onComplete,
    enablePersistence: true
  });

  const [showScanner, setShowScanner] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [currentFailedItem, setCurrentFailedItem] = useState<InspectionItem | null>(null);
  const [networkStatus, setNetworkStatus] = useState(navigator.onLine);
  const [queueStatus, setQueueStatus] = useState(inspectionQueue.getStatus());
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [activeOverrideId, setActiveOverrideId] = useState<string | null>(null);

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
    if (!data && activeOverrideId) {
      // Supervisor override - skip QR validation
      supervisorOverride.useOverride(activeOverrideId, 'worker');
      recordResult(currentItem.id, 'pass', `Skipped with override: ${overrideReason}`);
      setActiveOverrideId(null);
    } else if (data) {
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
        data: {
          stepId: currentItem.id,
          result: 'pass',
          timestamp: new Date().toISOString()
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
        data: {
          stepId: currentFailedItem.id,
          result: 'fail',
          issue,
          timestamp: new Date().toISOString()
        }
      });
      
      setCurrentFailedItem(null);
    }
    
    setIssueModalOpen(false);
    nextStep();
  };

  // Handle supervisor override request
  const handleOverrideRequest = async () => {
    if (!overrideReason.trim()) {
      alert('Please provide a reason for the override');
      return;
    }

    const response = await supervisorOverride.requestOverride({
      type: 'skip_step',
      orderId,
      workflowPhase,
      stepId: currentItem.id,
      reason: overrideReason,
      requestedBy: localStorage.getItem('user-id') || 'worker',
      metadata: {
        stepDescription: currentItem.description
      }
    });

    if (response.approved) {
      setActiveOverrideId(response.overrideId);
      setShowOverrideDialog(false);
      
      // Auto-advance with override
      recordResult(currentItem.id, 'pass', `Override: ${overrideReason}`);
      nextStep();
    } else {
      alert('Override request sent to supervisor for approval');
      setShowOverrideDialog(false);
    }
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
        <div className="bg-yellow-500 text-white px-4 py-2 text-center">
          <span className="font-semibold">Offline Mode</span> - Changes will sync when connection restored
          {queueStatus.queueLength > 0 && (
            <span className="ml-2">({queueStatus.queueLength} pending)</span>
          )}
        </div>
      )}

      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={previousStep}
            disabled={currentIndex === 0}
            className="text-white hover:text-blue-200 disabled:opacity-50"
          >
            ← Back
          </button>
          
          <div className="flex gap-2">
            {canUndo && (
              <button
                onClick={undo}
                className="px-3 py-1 bg-blue-500 rounded hover:bg-blue-400"
              >
                Undo
              </button>
            )}
            
            <button
              onClick={onSwitchToSupervisor}
              className="px-3 py-1 bg-blue-500 rounded hover:bg-blue-400"
            >
              Supervisor View
            </button>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold">Order #{orderNumber}</h1>
        <p className="text-blue-100">{customerName}</p>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="bg-blue-800 rounded-full h-3">
            <div 
              className="bg-white rounded-full h-3 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-sm">
            <span>Step {currentIndex + 1} of {items.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
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
            <button
              onClick={() => setShowScanner(true)}
              className="w-full py-6 bg-blue-600 text-white text-2xl rounded-lg hover:bg-blue-700"
            >
              📷 Scan QR Code
            </button>
            
            <button
              onClick={() => setShowOverrideDialog(true)}
              className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Request Override
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleResult('pass')}
              className="py-6 bg-green-600 text-white text-2xl rounded-lg hover:bg-green-700"
            >
              ✓ Pass
            </button>
            
            <button
              onClick={() => handleResult('fail')}
              className="py-6 bg-red-600 text-white text-2xl rounded-lg hover:bg-red-700"
            >
              ✗ Fail
            </button>
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
          allowSkip={!!activeOverrideId}
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

      {/* Override Dialog */}
      {showOverrideDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Request Supervisor Override</h3>
            
            <p className="text-gray-600 mb-4">
              Provide a reason for skipping this step:
            </p>
            
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full p-3 border rounded-lg"
              rows={3}
              placeholder="Enter reason..."
            />
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleOverrideRequest}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Submit Request
              </button>
              
              <button
                onClick={() => setShowOverrideDialog(false)}
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
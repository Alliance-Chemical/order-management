'use client';

import React, { useState, useEffect } from 'react';
import IssueModal from './IssueModal';
import { QRScanner } from '@/components/qr/QRScanner';
import { InspectionScreenProps, InspectionItem, InspectionResults } from '@/lib/types/worker-view';

export default function InspectionScreen({ 
  orderId, 
  orderNumber,
  customerName,
  orderItems,
  workflowPhase,
  workflowType, 
  items, 
  onComplete, 
  onSwitchToSupervisor 
}: InspectionScreenProps) {
  const [sourceAssignments, setSourceAssignments] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<string, 'pass' | 'fail'>>({});
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [currentFailedItem, setCurrentFailedItem] = useState<InspectionItem | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showScanner, setShowScanner] = useState(false);
  const [scannedQRs, setScannedQRs] = useState<Record<string, string>>({});
  const [currentItemWorkflowType, setCurrentItemWorkflowType] = useState<'pump_and_fill' | 'direct_resell' | null>(null);

  const currentItem = items[currentIndex];
  const progress = ((currentIndex + 1) / items.length) * 100;
  const isDirectResell = workflowType === 'direct_resell'; // Fallback for order-level workflow
  
  // Check if current item requires QR scanning
  const requiresQRScan = currentItem && (
    currentItem.id === 'scan_source_qr' || 
    currentItem.id === 'scan_destination_qr'
  );
  
  // Fetch source assignments on mount (includes workflow types per item)
  useEffect(() => {
    const fetchSourceAssignments = async () => {
      try {
        const response = await fetch(`/api/workspace/${orderId}/assign-source`);
        const data = await response.json();
        if (data.success && data.sourceAssignments) {
          setSourceAssignments(data.sourceAssignments);
          
          // Determine the workflow type for the current item being inspected
          // This would typically be based on QR scan data or item context
          // For now, check if any assignments match the current item
          if (orderItems && orderItems.length > 0) {
            const firstItem = orderItems[0];
            const assignment = data.sourceAssignments.find((sa: any) => 
              sa.productName && firstItem.name && 
              firstItem.name.toLowerCase().includes(sa.productName.toLowerCase())
            );
            if (assignment) {
              setCurrentItemWorkflowType(assignment.workflowType);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch source assignments:', error);
      }
    };
    
    fetchSourceAssignments();
  }, [orderId, orderItems]);

  const handleQRScan = (qrData: string) => {
    // Store the scanned QR data
    setScannedQRs({ ...scannedQRs, [currentItem.id]: qrData });
    
    // Process the QR scan to the backend
    fetch('/api/qr/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrCode: qrData,
        orderId,
        scanType: currentItem.id,
        timestamp: new Date().toISOString()
      })
    }).catch(console.error);
    
    // Close scanner and mark as passed
    setShowScanner(false);
    handlePass();
  };

  const handlePass = () => {
    // For QR scan items, clicking pass/scan button opens scanner
    if (requiresQRScan && !scannedQRs[currentItem.id]) {
      setShowScanner(true);
      return;
    }
    
    const newResults = { ...results, [currentItem.id]: 'pass' as const };
    setResults(newResults);
    
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Complete the inspection
      onComplete({
        checklist: newResults,
        notes: Object.values(notes).join('\n'),
        completedAt: new Date().toISOString(),
        completedBy: 'worker',
      });
    }
  };

  const handleFail = () => {
    setCurrentFailedItem(currentItem);
    setIssueModalOpen(true);
  };

  const handleIssueReported = (reason: string) => {
    const newResults = { ...results, [currentItem.id]: 'fail' as const };
    const newNotes = { ...notes, [currentItem.id]: reason };
    
    setResults(newResults);
    setNotes(newNotes);
    setIssueModalOpen(false);
    
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Complete the inspection with failures
      onComplete({
        checklist: newResults,
        notes: Object.entries(newNotes).map(([id, note]) => `${id}: ${note}`).join('\n'),
        completedAt: new Date().toISOString(),
        completedBy: 'worker',
      });
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const getPhaseLabel = () => {
    return workflowPhase === 'pre_mix' ? 'Pre-Mix' : 'Pre-Ship';
  };

  return (
    <div className="worker-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header with progress */}
        <div className="mb-8">
          {/* Small supervisor mode toggle */}
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={handleBack}
              disabled={currentIndex === 0}
              className={`text-worker-lg ${currentIndex === 0 ? 'text-gray-300' : 'text-gray-600 hover:text-gray-900'}`}
            >
              ← Back
            </button>
            <button
              onClick={onSwitchToSupervisor}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Supervisor View
            </button>
          </div>

          {/* Order Information Bar */}
          <div className="bg-blue-50 rounded-lg shadow p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-lg font-semibold text-gray-800">Order #{orderNumber || orderId}</span>
                {customerName && (
                  <span className="ml-3 text-gray-600">• {customerName}</span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {getPhaseLabel()}
              </div>
            </div>
            {orderItems && orderItems.length > 0 && (() => {
              const filteredItems = orderItems.filter(item =>
                !item.name?.toLowerCase().includes('discount') &&
                (!item.unitPrice || item.unitPrice >= 0) &&
                !item.lineItemKey?.includes('discount')
              );
              
              if (filteredItems.length === 0) return null;
              
              return (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <div className="text-sm font-semibold text-gray-700 mb-1">Items to Inspect:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {filteredItems.map((item, idx) => (
                      <div key={idx} className="text-sm text-gray-600">
                        • {item.quantity}x {item.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="worker-text font-bold">
                Step {currentIndex + 1} of {items.length}
              </span>
              <span className="worker-text text-gray-600">{Math.round(progress)}%</span>
            </div>
            <div className="worker-progress">
              <div 
                className="worker-progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Current Item Being Inspected - NEW PROMINENT DISPLAY */}
        {(() => {
          // For inspection, typically we're inspecting ALL items together as a batch
          // unless there's specific item context from QR scan or selection
          // Show which specific item this step relates to based on the current inspection step
          
          let itemBeingInspected = null;
          
          // Check if current step is specifically about scanning destination QR
          if (currentItem?.id === 'scan_destination_qr' && orderItems && orderItems.length > 0) {
            // For destination scanning, we might be scanning containers for any of the items
            // Show all items being processed
            return (
              <div className="mb-6 p-4 bg-yellow-100 border-2 border-yellow-400 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-yellow-800 uppercase tracking-wide mb-2">Items Being Processed:</p>
                  {orderItems.map((item, idx) => (
                    <p key={idx} className="text-lg font-bold text-gray-900">
                      • {item.quantity}x {item.name}
                    </p>
                  ))}
                </div>
              </div>
            );
          }
          
          // For source-related steps, try to match with source assignments
          if ((currentItem?.id === 'scan_source_qr' || currentItem?.id === 'verify_source_chemical') && sourceAssignments.length > 0) {
            // Show which items have pump & fill workflow
            const pumpAndFillItems = orderItems?.filter(item =>
              sourceAssignments.some(sa =>
                sa.workflowType === 'pump_and_fill' &&
                sa.productName &&
                item.name?.toLowerCase().includes(sa.productName.toLowerCase())
              )
            );
            
            if (pumpAndFillItems && pumpAndFillItems.length > 0) {
              itemBeingInspected = pumpAndFillItems[0]; // Show first pump & fill item
            }
          }
          
          // Default: show the order as a whole if no specific item context
          if (!itemBeingInspected && orderItems && orderItems.length === 1) {
            itemBeingInspected = orderItems[0];
          }
          
          if (itemBeingInspected) {
            return (
              <div className="mb-6 p-4 bg-yellow-100 border-2 border-yellow-400 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-yellow-800 uppercase tracking-wide">Currently Inspecting:</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {itemBeingInspected.quantity}x {itemBeingInspected.name}
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          
          return null;
        })()}

        {/* Current inspection item */}
        <div className="worker-card">
          <div className="text-center mb-8">
            {/* Show QR icon for scan steps, checklist icon for others */}
            <div className={`worker-icon-large mx-auto mb-4 ${requiresQRScan ? 'text-purple-600' : 'text-worker-blue'}`}>
              {requiresQRScan ? (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 4v1m6 11l.01-.01M12 12h.01M3 12h.01M12 19v1m8-16.364l-.707.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" 
                  />
                </svg>
              ) : (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" 
                  />
                </svg>
              )}
            </div>
            <h2 className="worker-title mb-4">{currentItem.label}</h2>
            <p className="worker-subtitle text-gray-600">{currentItem.description}</p>
            
            {/* Extra prominent message for QR scan steps */}
            {requiresQRScan && !scannedQRs[currentItem.id] && (
              <div className="mt-6 p-4 bg-purple-50 border-2 border-purple-300 rounded-xl animate-pulse">
                <p className="text-xl font-bold text-purple-800">
                  📷 Tap the big green button below to scan
                </p>
              </div>
            )}
            
            {/* Display source assignments or direct resell status based on item workflow */}
            {(() => {
              // Only show source-related info on source scanning steps
              if (currentItem?.id !== 'scan_source_qr' && currentItem?.id !== 'verify_source_chemical') {
                return null;
              }
              
              // Get the specific item being inspected
              // For multiple items, try to determine which one based on context
              let inspectedItem = null;
              if (orderItems && orderItems.length === 1) {
                inspectedItem = orderItems[0];
              } else if (orderItems && orderItems.length > 0) {
                // For multiple items, default to first one for now
                // In a real scenario, this would be determined by QR scan or user selection
                inspectedItem = orderItems[0];
              }
              
              if (!inspectedItem) return null;
              
              // Find the assignment for this specific item
              const itemAssignment = sourceAssignments.find(sa => {
                if (!sa.productName || !inspectedItem.name) return false;
                // More precise matching - check if the assignment product name is contained in the item name
                return inspectedItem.name.toLowerCase().includes(sa.productName.toLowerCase()) ||
                       sa.productName.toLowerCase().includes(inspectedItem.name.toLowerCase().split('-')[0].trim());
              });
              
              // Check if this specific item is direct resell
              if (itemAssignment?.workflowType === 'direct_resell' && currentItem.id === 'scan_source_qr') {
                // Skip source scanning for direct resell items
                return (
                  <div className="mt-6 p-4 bg-green-100 border-2 border-green-500 rounded-lg">
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-800">
                        📦 Direct Resell Item - No source scan needed
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        This is a pre-packaged container ready for shipment
                      </p>
                    </div>
                  </div>
                );
              }
              
              // Show source containers for pump & fill items
              if (itemAssignment?.workflowType === 'pump_and_fill') {
                const allSources = itemAssignment.sourceContainers || [];
                
                if (allSources.length > 0) {
                  return (
                    <div className="mt-6 p-4 bg-blue-100 border-2 border-blue-500 rounded-lg">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-800">
                            Fill From Source{allSources.length > 1 ? 's' : ''}:
                          </p>
                          {allSources.map((source, idx) => (
                            <p key={idx} className="text-xl font-bold text-blue-900">
                              {idx + 1}. {source.name || source.sourceContainerName}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
              }
              
              return null;
            })()}
          </div>

          {/* Show if QR has been scanned for this item */}
          {requiresQRScan && scannedQRs[currentItem.id] && (
            <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
              <p className="text-center text-green-800 font-semibold">
                ✓ QR Code Scanned Successfully
              </p>
            </div>
          )}

          {/* Action buttons */}
          {requiresQRScan && !scannedQRs[currentItem.id] ? (
            // Single large scan button for QR steps
            <div className="mt-8">
              <button
                onClick={handlePass}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transform transition-all hover:scale-105 shadow-xl"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-6">
                  <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2.5} 
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2.5} 
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <span className="text-3xl font-bold">TAP TO SCAN QR CODE</span>
                <span className="text-lg opacity-90">Camera will open automatically</span>
              </button>
              
              {/* Small skip option */}
              <div className="mt-4 text-center">
                <button
                  onClick={handleFail}
                  className="text-gray-500 hover:text-red-600 underline text-sm"
                >
                  Report a problem instead
                </button>
              </div>
            </div>
          ) : (
            // Regular pass/fail buttons for non-QR steps
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={handlePass}
                className="worker-btn-green flex flex-col items-center justify-center gap-2"
              >
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={3} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
                <span>PASS</span>
              </button>
              
              <button
                onClick={handleFail}
                className="worker-btn-red flex flex-col items-center justify-center gap-2"
              >
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={3} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
                <span>FAIL</span>
              </button>
            </div>
          )}

          {/* Previous results indicator */}
          {currentIndex > 0 && (
            <div className="mt-8 p-4 bg-gray-100 rounded-lg">
              <div className="flex items-center justify-center gap-2">
                <span className="worker-text text-gray-600">Previous items checked:</span>
                <div className="flex gap-1">
                  {Array.from({ length: currentIndex }).map((_, i) => {
                    const itemId = items[i].id;
                    const result = results[itemId];
                    return (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full ${
                          result === 'pass' ? 'bg-worker-green' : 
                          result === 'fail' ? 'bg-worker-red' : 
                          'bg-gray-300'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Issue reporting modal */}
      {issueModalOpen && currentFailedItem && (
        <IssueModal
          isOpen={issueModalOpen}
          onClose={() => setIssueModalOpen(false)}
          orderId={orderId}
          item={currentFailedItem}
          workflowPhase={workflowPhase}
          onIssueReported={handleIssueReported}
        />
      )}

      {/* QR Scanner modal */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
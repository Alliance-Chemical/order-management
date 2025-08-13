'use client';

import React, { useState, useEffect } from 'react';
import IssueModal from './IssueModal';
import { QRScanner } from '@/components/qr/QRScanner';
import { InspectionScreenProps, InspectionItem, InspectionResults } from '@/lib/types/agent-view';

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
  const [autoSkipping, setAutoSkipping] = useState(false);

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

  // Helper function to determine if current item is Direct Resell
  const getItemWorkflowType = () => {
    if (!orderItems || orderItems.length === 0 || sourceAssignments.length === 0) return null;
    
    // Support both single item and multi-item inspection
    const inspectedItems = orderItems.length === 1 ? [orderItems[0]] : orderItems;
    
    // Check if ALL items being inspected have the same workflow type
    const workflows = inspectedItems.map(item => {
      const itemAssignment = sourceAssignments.find(sa => {
        if (!sa.productName || !item.name) return false;
        
        // Enhanced matching logic
        const productNameLower = sa.productName.toLowerCase();
        const itemNameLower = item.name.toLowerCase();
        
        // Direct match
        if (itemNameLower.includes(productNameLower)) return true;
        
        // Match without size/container info (e.g., "Citric Acid USP - 55 Gal Drum" matches "Citric Acid USP")
        const itemBaseName = itemNameLower.split('-')[0].trim();
        if (productNameLower.includes(itemBaseName)) return true;
        
        // Match with partial product name (e.g., "Sodium Hypochlorite" matches "Sodium Hypochlorite 12.5%")
        const productBaseName = productNameLower.split('%')[0].trim();
        if (itemBaseName.includes(productBaseName)) return true;
        
        return false;
      });
      
      return itemAssignment?.workflowType || null;
    });
    
    // If all items have the same workflow type, return it
    const uniqueWorkflows = [...new Set(workflows.filter(w => w !== null))];
    return uniqueWorkflows.length === 1 ? uniqueWorkflows[0] : null;
  };

  // Auto-skip source scanning for direct resell items
  useEffect(() => {
    if (!currentItem || sourceAssignments.length === 0 || autoSkipping) return;
    
    // Check if current step is source-related
    const isSourceStep = currentItem.id === 'scan_source_qr' || currentItem.id === 'verify_source_chemical';
    if (!isSourceStep) return;
    
    const itemWorkflowType = getItemWorkflowType();
    
    // If this is a direct resell item, auto-advance with visual feedback
    if (itemWorkflowType === 'direct_resell') {
      setAutoSkipping(true);
      
      // Small delay to show the "auto-advancing" message
      const timer = setTimeout(() => {
        // Mark as passed
        const newResults = { ...results, [currentItem.id]: 'pass' as const };
        setResults(newResults);
        
        // Advance to next step
        if (currentIndex < items.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setAutoSkipping(false);
        } else {
          // Complete the inspection if this was the last item
          onComplete({
            checklist: newResults,
            notes: Object.values(notes).join('\n'),
            completedAt: new Date().toISOString(),
            completedBy: 'worker',
          });
        }
      }, 800); // Brief delay for visual feedback
      
      return () => clearTimeout(timer);
    }
  }, [currentItem, sourceAssignments, orderItems, currentIndex, autoSkipping]);

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

        {/* Current Item Being Inspected - ENHANCED FOR SINGLE ITEM FOCUS */}
        {(() => {
          // When only one item is being inspected (selected from task list)
          if (orderItems && orderItems.length === 1) {
            const item = orderItems[0];
            const workflowType = getItemWorkflowType();
            
            return (
              <div className="mb-6 p-6 bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-400 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <p className="text-sm font-bold text-yellow-800 uppercase tracking-wide">Currently Inspecting:</p>
                      {workflowType === 'direct_resell' && (
                        <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                          DIRECT RESELL
                        </span>
                      )}
                      {workflowType === 'pump_and_fill' && (
                        <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                          PUMP & FILL
                        </span>
                      )}
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                      {item.quantity}x {item.name}
                    </p>
                    {item.sku && (
                      <p className="text-sm text-gray-600 mt-1">SKU: {item.sku}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white">
                      <span className="text-3xl font-bold">{item.quantity}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          
          // Multiple items being inspected (batch mode)
          if (orderItems && orderItems.length > 1) {
            return (
              <div className="mb-6 p-4 bg-yellow-100 border-2 border-yellow-400 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-yellow-800 uppercase tracking-wide mb-2">Items Being Processed (Batch Mode):</p>
                  {orderItems.map((item, idx) => (
                    <p key={idx} className="text-lg font-bold text-gray-900">
                      • {item.quantity}x {item.name}
                    </p>
                  ))}
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
              const isSourceStep = currentItem?.id === 'scan_source_qr' || currentItem?.id === 'verify_source_chemical';
              if (!isSourceStep) return null;
              
              const itemWorkflowType = getItemWorkflowType();
              
              // Check if this specific item is direct resell
              if (itemWorkflowType === 'direct_resell') {
                // Clean, simple message for direct resell items
                return (
                  <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl shadow-md">
                    <div className="flex items-center justify-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-green-800">
                          Direct Resell Container
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          Pre-packaged • No source scan required
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Show source containers for pump & fill items
              if (itemWorkflowType === 'pump_and_fill') {
                // Find the specific assignment
                const inspectedItem = orderItems?.[0];
                if (!inspectedItem) return null;
                
                const itemAssignment = sourceAssignments.find(sa => {
                  if (!sa.productName || !inspectedItem.name) return false;
                  return inspectedItem.name.toLowerCase().includes(sa.productName.toLowerCase()) ||
                         sa.productName.toLowerCase().includes(inspectedItem.name.toLowerCase().split('-')[0].trim());
                });
                
                const allSources = itemAssignment?.sourceContainers || [];
                
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

          {/* Action buttons - conditionally render based on workflow type */}
          {(() => {
            // Check if this is a direct resell item on a source scanning step
            const isSourceStep = currentItem?.id === 'scan_source_qr' || currentItem?.id === 'verify_source_chemical';
            const itemWorkflowType = getItemWorkflowType();
            
            // If direct resell item on source step, show auto-skip UI
            if (isSourceStep && itemWorkflowType === 'direct_resell') {
              if (autoSkipping) {
                // Elegant auto-advancing animation with smooth transitions
                return (
                  <div className="mt-8 p-8 text-center">
                    <div className="inline-flex flex-col items-center justify-center space-y-6">
                      {/* Animated icon container */}
                      <div className="relative">
                        {/* Background glow effect */}
                        <div className="absolute -inset-4 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full opacity-20 blur-xl animate-pulse"></div>
                        
                        {/* Main icon circle */}
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg transform transition-all duration-300 hover:scale-110">
                          {/* Package icon for Direct Resell */}
                          <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        
                        {/* Animated ring */}
                        <div className="absolute inset-0 rounded-full border-4 border-green-400 opacity-75 animate-ping"></div>
                        
                        {/* Success checkmark overlay */}
                        <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Text content with fade-in animation */}
                      <div className="space-y-3 animate-fadeIn">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="h-px w-12 bg-gradient-to-r from-transparent to-green-400"></div>
                          <p className="text-sm uppercase tracking-widest text-green-600 font-semibold">Pre-Packaged</p>
                          <div className="h-px w-12 bg-gradient-to-l from-transparent to-green-400"></div>
                        </div>
                        <h3 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                          Direct Resell Container
                        </h3>
                        <p className="text-lg text-gray-600 flex items-center justify-center space-x-2">
                          <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                          <span>Auto-advancing to next step</span>
                          <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse animation-delay-200"></span>
                        </p>
                      </div>
                    </div>
                    
                    {/* Add CSS animations in a style tag */}
                    <style jsx>{`
                      @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                      }
                      .animate-fadeIn {
                        animation: fadeIn 0.5s ease-out;
                      }
                      .animation-delay-200 {
                        animation-delay: 200ms;
                      }
                    `}</style>
                  </div>
                );
              } else {
                // This shouldn't show as auto-skip should trigger immediately, but kept as fallback
                return (
                  <div className="mt-8 p-6 text-center">
                    <div className="text-gray-500">Processing...</div>
                  </div>
                );
              }
            }
            
            // Regular QR scan button for pump & fill items
            if (requiresQRScan && !scannedQRs[currentItem.id]) {
              return (
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
              );
            }
            
            // Regular pass/fail buttons for non-QR steps
            return (
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
            );
          })()}

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
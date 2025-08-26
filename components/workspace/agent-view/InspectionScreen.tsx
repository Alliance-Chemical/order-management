'use client';

import React, { useState, useEffect } from 'react';
import IssueModal from './IssueModal';
import { QRScanner } from '@/components/qr/QRScanner';
import MultiContainerInspection from './MultiContainerInspection';
import { InspectionScreenProps, InspectionItem } from '@/lib/types/agent-view';
import { warehouseFeedback, visualFeedback, formatWarehouseText } from '@/lib/warehouse-ui-utils';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<string, 'pass' | 'fail'>>({});
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [currentFailedItem, setCurrentFailedItem] = useState<InspectionItem | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showScanner, setShowScanner] = useState(false);
  const [scannedQRs, setScannedQRs] = useState<Record<string, string>>({});
  const [useMultiContainerFlow, setUseMultiContainerFlow] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const currentItem = items[currentIndex];
  const progress = ((currentIndex + 1) / items.length) * 100;
  
  // Check if current item requires QR scanning (destination only now)
  const requiresQRScan = currentItem && (
    currentItem.id === 'scan_destination_qr' || 
    currentItem.id === 'scan_qr' || 
    currentItem.id.includes('qr')
  );
  
  // Detect if this is a bulk container order (totes/drums)
  const detectContainerType = (itemName: string): 'tote' | 'drum' | 'pail' | 'bottle' | null => {
    const nameLower = itemName.toLowerCase();
    
    // Check for totes (including "275 Gallon Tote" pattern)
    if (nameLower.includes('tote') || nameLower.includes('275 gallon')) return 'tote';
    if (nameLower.includes('drum') || nameLower.includes('55 gal')) return 'drum';
    if (nameLower.includes('pail')) return 'pail';
    // Only treat smaller gallons as pails (not 275 gallon which is a tote)
    if ((nameLower.includes('gallon') || nameLower.includes('gal')) && !nameLower.includes('275')) return 'pail';
    if (nameLower.includes('bottle')) return 'bottle';
    return null;
  };

  // Check if we should use multi-container flow
  useEffect(() => {
    if (orderItems && orderItems.length === 1) {
      const item = orderItems[0];
      const containerType = detectContainerType(item.name);
      
      // Use multi-container flow for bulk orders:
      // - Totes/drums with 3+ containers
      // - Any container type with 10+ units
      if (containerType && (
        ((containerType === 'tote' || containerType === 'drum') && item.quantity >= 3) ||
        item.quantity >= 10
      )) {
        setUseMultiContainerFlow(true);
      }
    }
  }, [orderItems]);

  // SIMPLIFIED: Removed source assignment fetching for cleaner flow
  // Focus on destination container inspection only
  useEffect(() => {
    // Skip source assignment complexity
    // All items treated as destination containers for inspection
  }, [orderId, orderItems]);

  // SIMPLIFIED: Removed workflow type detection
  // All items are treated the same for inspection

  // SIMPLIFIED: Removed auto-skip logic
  // All items require manual inspection

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
      warehouseFeedback.buttonPress();
      setShowScanner(true);
      return;
    }
    
    // Provide success feedback
    warehouseFeedback.success();
    
    const newResults = { ...results, [currentItem.id]: 'pass' as const };
    setResults(newResults);
    
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Complete the inspection with celebration
      warehouseFeedback.complete();
      onComplete({
        checklist: newResults,
        notes: Object.values(notes).join('\n'),
        completedAt: new Date().toISOString(),
        completedBy: 'worker',
      });
    }
  };

  const handleFail = () => {
    warehouseFeedback.error();
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

  // Use multi-container flow for bulk tote/drum orders
  if (useMultiContainerFlow && orderItems && orderItems.length === 1) {
    const item = orderItems[0];
    const containerType = detectContainerType(item.name) || 'tote';
    
    return (
      <MultiContainerInspection
        orderId={orderId}
        orderNumber={orderNumber || orderId}
        customerName={customerName}
        item={item}
        workflowType="direct_resell"
        containerType={containerType}
        onComplete={onComplete}
        onSwitchToSupervisor={onSwitchToSupervisor}
      />
    );
  }

  // Jump to specific inspection step
  const handleJumpToStep = (stepIndex: number) => {
    setCurrentIndex(stepIndex);
  };

  return (
    <div className="warehouse-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header with progress */}
        <div className="mb-8">
          {/* Navigation bar */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => {
                warehouseFeedback.buttonPress();
                handleBack();
              }}
              disabled={currentIndex === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-warehouse text-warehouse-lg font-bold transition-all
                ${currentIndex === 0 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-warehouse-neutral text-white shadow-warehouse hover:shadow-warehouse-lg active:scale-95'}`}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              BACK
            </button>
            <button
              onClick={() => {
                warehouseFeedback.buttonPress();
                onSwitchToSupervisor();
              }}
              className="px-4 py-2 bg-gray-200 text-gray-600 rounded-warehouse text-sm font-bold hover:bg-gray-300 transition-all"
            >
              SUPERVISOR MODE
            </button>
          </div>

          {/* Order Information Card - Like a Job Ticket */}
          <div className="warehouse-ticket bg-warehouse-bg-highlight mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="warehouse-label text-warehouse-text-secondary mb-1">ORDER NUMBER</div>
                <div className="text-warehouse-3xl font-black text-warehouse-text-primary">
                  #{orderNumber || orderId}
                </div>
                {customerName && (
                  <div className="mt-2">
                    <span className="warehouse-label text-warehouse-text-secondary">CUSTOMER: </span>
                    <span className="text-warehouse-lg font-bold">{customerName}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="warehouse-badge-info text-warehouse-xl">
                  {formatWarehouseText(getPhaseLabel(), 'action')}
                </div>
              </div>
            </div>
            {orderItems && orderItems.length > 0 && (() => {
              const filteredItems = orderItems.filter(item =>
                !item.name?.toLowerCase().includes('discount') &&
                (!item.unitPrice || item.unitPrice >= 0)
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

          {/* Enhanced Progress Indicator */}
          <div className="warehouse-card mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="step-number-active">
                  {currentIndex + 1}
                </div>
                <div>
                  <div className="warehouse-label">CHECKPOINT</div>
                  <div className="text-warehouse-2xl font-black">
                    {currentIndex + 1} OF {items.length}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-warehouse-3xl font-black text-warehouse-go">
                  {Math.round(progress)}%
                </div>
                <div className="warehouse-label text-warehouse-text-secondary">COMPLETE</div>
              </div>
            </div>
            <div className="warehouse-progress">
              <div 
                className="warehouse-progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Interactive Timeline Navigation */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between gap-2 overflow-x-auto">
                {items.map((item, idx) => {
                  const stepResult = results[item.id];
                  const isCurrentStep = idx === currentIndex;
                  const isCompleted = stepResult === 'pass' || stepResult === 'fail';
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleJumpToStep(idx)}
                      className={`
                        flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg transition-all
                        ${isCurrentStep ? 'bg-blue-100 border-2 border-blue-500' : 
                          isCompleted ? 'bg-gray-50 hover:bg-gray-100' : 
                          'bg-white hover:bg-gray-50 border border-gray-200'}
                      `}
                      title={item.label}
                    >
                      {/* Step Number Circle */}
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                        ${isCurrentStep ? 'bg-blue-500 text-white' :
                          stepResult === 'pass' ? 'bg-green-500 text-white' :
                          stepResult === 'fail' ? 'bg-red-500 text-white' :
                          'bg-gray-300 text-gray-700'}
                      `}>
                        {stepResult === 'pass' ? '✓' : 
                         stepResult === 'fail' ? '✗' : 
                         idx + 1}
                      </div>
                      
                      {/* Step Label (abbreviated on mobile) */}
                      <span className={`
                        text-xs font-medium max-w-[60px] truncate
                        ${isCurrentStep ? 'text-blue-700' : 'text-gray-600'}
                      `}>
                        {item.label.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Passed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Failed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                  <span>Pending</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Item Being Inspected - ENHANCED FOR SINGLE ITEM FOCUS */}
        {(() => {
          // When only one item is being inspected (selected from task list)
          if (orderItems && orderItems.length === 1) {
            const item = orderItems[0];
            const workflowType = null; // Simplified - no workflow type detection
            
            return (
              <div className="mb-6 p-6 bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-400 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <p className="text-sm font-bold text-yellow-800 uppercase tracking-wide">Currently Inspecting:</p>
                      <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                        CONTAINER
                      </span>
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

        {/* Current Inspection Task Card */}
        <div className="warehouse-card-active">
          <div className="text-center mb-8">
            {/* Large Icon with Physical Appearance */}
            <div className={`warehouse-icon-2xl mx-auto mb-6 p-6 rounded-full shadow-warehouse-xl
              ${requiresQRScan 
                ? 'bg-purple-100 text-purple-700 border-4 border-purple-500' 
                : 'bg-warehouse-info bg-opacity-20 text-warehouse-info border-4 border-warehouse-info'}`}>
              {requiresQRScan ? (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M12 4v1m6 11l.01-.01M12 12h.01M3 12h.01M12 19v1m8-16.364l-.707.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" 
                  />
                </svg>
              ) : (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" 
                  />
                </svg>
              )}
            </div>
            <div className="flex items-center justify-center gap-4 mb-6">
              <h2 className="warehouse-title text-warehouse-4xl">
                {formatWarehouseText(currentItem.label, 'critical')}
              </h2>
              <button
                onClick={() => {
                  warehouseFeedback.buttonPress();
                  setShowHelpModal(true);
                }}
                className="p-4 bg-warehouse-info text-white rounded-full shadow-warehouse-lg hover:shadow-warehouse-xl transition-all active:scale-95"
                title="What am I inspecting?"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            
            {/* Container Type Indicator - simplified for destination only */}
            <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-green-100 border-2 border-green-400 rounded-full">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-bold text-green-700">INSPECTING CONTAINER</span>
            </div>
            
            <p className="warehouse-subtitle text-warehouse-text-secondary mb-6">
              {currentItem.description}
            </p>
            
            {/* Extra prominent message for QR scan steps */}
            {requiresQRScan && !scannedQRs[currentItem.id] && (
              <div className="mt-6 p-6 bg-purple-100 border-4 border-purple-500 rounded-warehouse-lg shadow-warehouse-lg animate-pulse-strong">
                <div className="flex items-center justify-center gap-3">
                  <div className="warehouse-icon text-purple-700">
                    <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" 
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" 
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-warehouse-2xl font-black text-purple-800">
                    {formatWarehouseText('TAP GREEN BUTTON TO SCAN', 'action')}
                  </p>
                </div>
              </div>
            )}
            
            {/* SIMPLIFIED: Removed source container display - focus on destination only */}
          </div>

          {/* Show if QR has been scanned for this item */}
          {requiresQRScan && scannedQRs[currentItem.id] && (
            <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
              <p className="text-center text-green-800 font-semibold">
                ✓ QR Code Scanned Successfully
              </p>
            </div>
          )}

          {/* Action buttons - simplified without workflow checks */}
          {(() => {
            // Enhanced QR scan button with physical appearance
            if (requiresQRScan && !scannedQRs[currentItem.id]) {
              return (
                <div className="mt-8">
                  <button
                    onClick={handlePass}
                    className="warehouse-btn-info min-h-touch-xl w-full flex flex-col items-center justify-center gap-4
                      bg-gradient-to-b from-purple-500 to-purple-700 border-purple-900 hover:from-purple-600 hover:to-purple-800"
                  >
                    <div className="bg-white bg-opacity-30 rounded-full p-8 shadow-warehouse-lg">
                      <svg className="w-24 h-24" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-warehouse-3xl">{formatWarehouseText('TAP TO SCAN', 'action')}</span>
                      <span className="text-warehouse-xl opacity-90">QR CODE</span>
                      <div className="flex items-center gap-2 mt-2 text-warehouse-base opacity-80">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span>Camera opens automatically</span>
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse animation-delay-200"></div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Problem reporting option */}
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleFail}
                      className="px-6 py-3 bg-warehouse-caution text-warehouse-text-primary rounded-warehouse 
                        font-bold text-warehouse-base hover:bg-yellow-500 transition-all shadow-warehouse"
                    >
                      CAN'T SCAN - REPORT PROBLEM
                    </button>
                  </div>
                </div>
              );
            }
            
            // Enhanced pass/fail buttons with physical appearance
            return (
              <div className="grid grid-cols-2 gap-8 mt-8">
                <button
                  onClick={handlePass}
                  className="warehouse-btn-go min-h-touch-lg flex flex-col items-center justify-center gap-4"
                >
                  <div className="warehouse-icon-xl bg-white bg-opacity-30 rounded-full p-4">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}>
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M5 13l4 4L19 7" 
                      />
                    </svg>
                  </div>
                  <span className="text-warehouse-2xl">{formatWarehouseText('PASS', 'action')}</span>
                  <span className="text-warehouse-base opacity-90">ALL GOOD</span>
                </button>
                
                <button
                  onClick={handleFail}
                  className="warehouse-btn-stop min-h-touch-lg flex flex-col items-center justify-center gap-4"
                >
                  <div className="warehouse-icon-xl bg-white bg-opacity-30 rounded-full p-4">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}>
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M6 18L18 6M6 6l12 12" 
                      />
                    </svg>
                  </div>
                  <span className="text-warehouse-2xl">{formatWarehouseText('FAIL', 'action')}</span>
                  <span className="text-warehouse-base opacity-90">FOUND ISSUE</span>
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

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Inspection Help</h2>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Container Explanation - Simplified */}
                <div className="border-l-4 border-green-500 pl-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-green-700">CONTAINERS TO INSPECT</h3>
                  </div>
                  <p className="text-gray-700 mb-2">
                    <strong>What:</strong> The containers that will be shipped to the customer
                  </p>
                  <p className="text-gray-700 mb-2">
                    <strong>When inspected:</strong> For ALL orders - these need the most careful inspection
                  </p>
                  <p className="text-gray-700">
                    <strong>Why:</strong> These go directly to customers, so we check for:
                  </p>
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-gray-700">
                    <li>Damage, leaks, or contamination</li>
                    <li>Correct labels and hazmat placards</li>
                    <li>Proper seals and packaging</li>
                    <li>Correct quantity</li>
                  </ul>
                </div>

                {/* Simplified Inspection Focus */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-3">What We're Checking:</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <p className="text-sm text-gray-700">Container condition - no damage or leaks</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <p className="text-sm text-gray-700">Labels are correct and readable</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <p className="text-sm text-gray-700">QR codes scan properly</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <p className="text-sm text-gray-700">Seals are intact and secure</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <p className="text-sm text-gray-700">Quantity matches the order</p>
                    </div>
                  </div>
                </div>

                {/* Current Step Info */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-2">Current Step:</h3>
                  <p className="text-lg font-semibold text-blue-700">{currentItem.label}</p>
                  <p className="text-gray-700 mt-1">{currentItem.description}</p>
                </div>
              </div>

              <button
                onClick={() => setShowHelpModal(false)}
                className="mt-6 w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Got it, continue inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
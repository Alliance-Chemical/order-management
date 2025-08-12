'use client';

import React from 'react';
import { EntryScreenProps } from '@/lib/types/worker-view';

export default function EntryScreen({ workspace, onStart, onSwitchToSupervisor }: EntryScreenProps) {
  const isDirectResell = workspace.workflowType === 'direct_resell';
  
  const getButtonText = () => {
    if (isDirectResell) {
      return 'START DIRECT INSPECTION';
    }
    if (workspace.workflowPhase === 'pre_mix') {
      return 'START PRE-MIX INSPECTION';
    } else if (workspace.workflowPhase === 'pre_ship') {
      return 'START PRE-SHIP INSPECTION';
    }
    return 'START INSPECTION';
  };

  const getPhaseLabel = () => {
    if (isDirectResell) {
      return 'Direct Resell Inspection';
    }
    if (workspace.workflowPhase === 'pre_mix') {
      return 'Pre-Mix Inspection';
    } else if (workspace.workflowPhase === 'pre_ship') {
      return 'Pre-Ship Inspection';
    }
    return 'Inspection';
  };

  return (
    <div className="worker-screen">
      <div className="max-w-4xl mx-auto">
        {/* Small supervisor mode toggle in corner */}
        <div className="flex justify-end mb-4">
          <button
            onClick={onSwitchToSupervisor}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Switch to Supervisor View
          </button>
        </div>

        {/* Main content card */}
        <div className="worker-card">
          {/* Phase indicator */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center px-6 py-3 bg-worker-blue text-white rounded-full">
              <span className="text-worker-xl font-bold">{getPhaseLabel()}</span>
            </div>
          </div>

          {/* Order information */}
          <div className="space-y-6 mb-12">
            <div className="text-center">
              <div className="worker-label text-gray-600 mb-2">Order #:</div>
              <div className="worker-title text-worker-gray">{workspace.orderNumber || workspace.orderId}</div>
            </div>

            {workspace.shipstationData?.shipTo?.name && (
              <div className="text-center">
                <div className="worker-label text-gray-600 mb-2">Customer:</div>
                <div className="worker-subtitle">{workspace.shipstationData.shipTo.name}</div>
              </div>
            )}

            {workspace.shipstationData?.items && workspace.shipstationData.items.length > 0 && (() => {
              const filteredItems = workspace.shipstationData.items.filter((item: any) => 
                !item.name?.toLowerCase().includes('discount') && 
                item.unitPrice >= 0 && 
                !item.lineItemKey?.includes('discount')
              );
              
              if (filteredItems.length === 0) return null;
              
              return (
                <div className="text-center">
                  <div className="worker-label text-gray-600 mb-2">Items:</div>
                  <div className="space-y-2">
                    {filteredItems.slice(0, 3).map((item: any, index: number) => (
                      <div key={index} className="worker-text">
                        {item.quantity}x {item.name}
                      </div>
                    ))}
                    {filteredItems.length > 3 && (
                      <div className="worker-text text-gray-500">
                        +{filteredItems.length - 3} more items
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Action button */}
          <div className="flex justify-center">
            <button
              onClick={onStart}
              className="worker-btn-green w-full max-w-2xl flex items-center justify-center gap-4"
            >
              <svg 
                className="w-8 h-8" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={3} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span>{getButtonText()}</span>
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <div className="worker-text text-center text-gray-700">
              Tap the button above to begin the {getPhaseLabel().toLowerCase()}. 
              You will check each item one at a time.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
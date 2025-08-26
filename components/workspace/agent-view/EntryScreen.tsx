'use client';

import React, { useState } from 'react';
import { EntryScreenProps } from '@/lib/types/agent-view';
import TaskListItem from './TaskListItem';

export default function EntryScreen({ workspace, onStart, onSwitchToSupervisor, onSelectItem }: EntryScreenProps & { onSelectItem?: (item: any) => void }) {
  const [itemStatuses, setItemStatuses] = useState<Record<string, 'pending' | 'in_progress' | 'completed'>>({});

  const getPhaseLabel = () => {
    if (workspace.workflowPhase === 'pre_mix') {
      return 'Pre-Mix Inspection Tasks';
    } else if (workspace.workflowPhase === 'pre_ship') {
      return 'Pre-Ship Inspection Tasks';
    }
    return 'Inspection Tasks';
  };
  
  const getButtonText = () => {
    if (workspace.workflowType === 'direct_resell') {
      return 'START DIRECT INSPECTION';
    }
    if (workspace.workflowPhase === 'pre_mix') {
      return 'START PRE-MIX INSPECTION';
    } else if (workspace.workflowPhase === 'pre_ship') {
      return 'START PRE-SHIP INSPECTION';
    }
    return 'START INSPECTION';
  };
  
  // Helper to get workflow type for an item (simplified - use workspace level)
  const getItemWorkflowType = (item: any) => {
    return workspace.workflowType || 'pump_and_fill';
  };
  
  // Helper to check if dilution is required (placeholder - would need actual logic)
  const requiresDilution = (item: any) => {
    return false; // Placeholder
  };
  
  // Handle item selection
  const handleSelectItem = (item: any) => {
    if (onSelectItem) {
      // Mark item as in progress
      setItemStatuses(prev => ({
        ...prev,
        [item.lineItemKey || item.sku || item.name]: 'in_progress'
      }));
      onSelectItem(item);
    } else {
      // Fallback to old behavior
      onStart();
    }
  };

  // Get filtered items (exclude discounts)
  const getFilteredItems = () => {
    if (!workspace.shipstationData?.items) return [];
    return workspace.shipstationData.items.filter((item: any) => 
      !item.name?.toLowerCase().includes('discount') && 
      (!item.unitPrice || item.unitPrice >= 0) && 
      !item.lineItemKey?.includes('discount')
    );
  };
  
  const filteredItems = getFilteredItems();
  const hasMultipleItems = filteredItems.length > 1;

  // If only one item, use simplified single item view
  if (!hasMultipleItems && filteredItems.length === 1) {
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

          {/* Single item card */}
          <div className="worker-card">
            <div className="mb-8 text-center">
              <div className="inline-flex items-center px-6 py-3 bg-worker-blue text-white rounded-full">
                <span className="text-worker-xl font-bold">{getPhaseLabel()}</span>
              </div>
            </div>
            
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
              
              <div className="text-center">
                <div className="worker-label text-gray-600 mb-2">Item:</div>
                <div className="worker-text">
                  {filteredItems[0].quantity}x {filteredItems[0].name}
                </div>
              </div>

              <div className="text-center">
                <div className="worker-label text-gray-600 mb-2">Fulfillment Method:</div>
                <div className="worker-text">
                  {getItemWorkflowType(filteredItems[0]) === 'direct_resell' ? 'Ready to Ship' : 'Pump & Fill'}
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={onStart}
                className="worker-btn-go text-warehouse-4xl font-black px-16 py-8"
                style={{ minHeight: '120px' }}
              >
                {getButtonText()}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Multiple items view - simplified task list
  return (
    <div className="worker-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header with supervisor toggle */}
        <div className="flex justify-between items-center mb-6">
          <div className="inline-flex items-center px-6 py-3 bg-worker-blue text-white rounded-full">
            <span className="text-worker-xl font-bold">{getPhaseLabel()}</span>
          </div>
          <button
            onClick={onSwitchToSupervisor}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Switch to Supervisor View
          </button>
        </div>

        <div className="worker-card">
          <div className="space-y-4 mb-8">
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
          </div>

          <div className="mb-8">
            <div className="worker-label text-gray-600 mb-4 text-center">
              Select an item to inspect:
            </div>
            <div className="space-y-4">
              {filteredItems.map((item: any, idx: number) => {
                const workflowType = getItemWorkflowType(item);
                const status = itemStatuses[item.lineItemKey || item.sku || item.name] || 'pending';

                return (
                  <TaskListItem
                    key={item.lineItemKey || item.sku || `item-${idx}`}
                    item={{
                      lineItemId: item.orderItemId || item.lineItemKey,
                      sku: item.sku,
                      name: item.name || 'Unknown Product',
                      quantity: item.quantity || 1,
                      unitPrice: item.unitPrice
                    }}
                    workflowType={workflowType}
                    requiresDilution={requiresDilution(item)}
                    status={status}
                    onStartInspection={() => handleSelectItem(item)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
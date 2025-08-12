'use client';

import React, { useState, useEffect } from 'react';
import { EntryScreenProps } from '@/lib/types/worker-view';
import TaskListItem from './TaskListItem';

export default function EntryScreen({ workspace, onStart, onSwitchToSupervisor, onSelectItem }: EntryScreenProps & { onSelectItem?: (item: any) => void }) {
  const [sourceAssignments, setSourceAssignments] = useState<any[]>([]);
  const [itemStatuses, setItemStatuses] = useState<Record<string, 'pending' | 'in_progress' | 'completed'>>({});
  
  // Fetch source assignments to determine workflow types
  useEffect(() => {
    const fetchSourceAssignments = async () => {
      try {
        const response = await fetch(`/api/workspace/${workspace.orderId}/assign-source`);
        const data = await response.json();
        if (data.success && data.sourceAssignments) {
          setSourceAssignments(data.sourceAssignments);
        }
      } catch (error) {
        console.error('Failed to fetch source assignments:', error);
      }
    };
    
    fetchSourceAssignments();
  }, [workspace.orderId]);

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
  
  // Helper to get workflow type for an item
  const getItemWorkflowType = (item: any) => {
    const assignment = sourceAssignments.find(sa => {
      if (!sa.productName || !item.name) return false;
      const productNameLower = sa.productName.toLowerCase();
      const itemNameLower = item.name.toLowerCase();
      
      // Direct match or partial match
      return itemNameLower.includes(productNameLower) || 
             productNameLower.includes(itemNameLower.split('-')[0].trim());
    });
    
    return assignment?.workflowType || workspace.workflowType || 'pump_and_fill';
  };
  
  // Helper to check if dilution is required (placeholder - would need actual logic)
  const requiresDilution = (item: any) => {
    // This would check source concentration vs target concentration
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

  // If only one item, use old behavior for backward compatibility
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
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={onStart}
                className="worker-btn-green w-full max-w-2xl flex items-center justify-center gap-4"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>START INSPECTION</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Multi-item task list view
  return (
    <div className="worker-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order #{workspace.orderNumber || workspace.orderId}</h1>
            {workspace.shipstationData?.shipTo?.name && (
              <p className="text-lg text-gray-600 mt-1">{workspace.shipstationData.shipTo.name}</p>
            )}
          </div>
          <button
            onClick={onSwitchToSupervisor}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Switch to Supervisor View
          </button>
        </div>

        {/* Phase banner */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4 mb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{getPhaseLabel()}</h2>
              <p className="text-blue-100 mt-1">Select an item below to begin inspection</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">
                {Object.values(itemStatuses).filter(s => s === 'completed').length} / {filteredItems.length}
              </div>
              <div className="text-sm text-blue-100">Completed</div>
            </div>
          </div>
        </div>

        {/* Task list - SORTED WITH PUMP & FILL ITEMS FIRST */}
        <div className="space-y-6">
          {(() => {
            // Sort items by workflow type
            const sortedItems = [...filteredItems].sort((a, b) => {
              const aWorkflow = getItemWorkflowType(a);
              const bWorkflow = getItemWorkflowType(b);
              
              // Pump & Fill items come first (higher priority)
              if (aWorkflow === 'pump_and_fill' && bWorkflow !== 'pump_and_fill') return -1;
              if (bWorkflow === 'pump_and_fill' && aWorkflow !== 'pump_and_fill') return 1;
              
              return 0;
            });
            
            // Group items by workflow type
            const pumpAndFillItems = sortedItems.filter(item => getItemWorkflowType(item) === 'pump_and_fill');
            const directResellItems = sortedItems.filter(item => getItemWorkflowType(item) === 'direct_resell');
            
            return (
              <>
                {/* Pump & Fill Items Section */}
                {pumpAndFillItems.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center space-x-2">
                      <div className="h-px flex-1 bg-blue-300"></div>
                      <span className="text-sm font-bold text-blue-600 uppercase tracking-wide px-3">
                        🔧 Pump & Fill Items (Priority)
                      </span>
                      <div className="h-px flex-1 bg-blue-300"></div>
                    </div>
                    <div className="space-y-3">
                      {pumpAndFillItems.map((item: any, index: number) => {
                        const itemKey = item.lineItemKey || item.sku || item.name;
                        const status = itemStatuses[itemKey] || 'pending';
                        
                        return (
                          <TaskListItem
                            key={itemKey || `pf-${index}`}
                            item={item}
                            workflowType="pump_and_fill"
                            requiresDilution={requiresDilution(item)}
                            status={status}
                            onStartInspection={() => handleSelectItem(item)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Direct Resell Items Section */}
                {directResellItems.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center space-x-2">
                      <div className="h-px flex-1 bg-green-300"></div>
                      <span className="text-sm font-bold text-green-600 uppercase tracking-wide px-3">
                        📦 Direct Resell Items
                      </span>
                      <div className="h-px flex-1 bg-green-300"></div>
                    </div>
                    <div className="space-y-3">
                      {directResellItems.map((item: any, index: number) => {
                        const itemKey = item.lineItemKey || item.sku || item.name;
                        const status = itemStatuses[itemKey] || 'pending';
                        
                        return (
                          <TaskListItem
                            key={itemKey || `dr-${index}`}
                            item={item}
                            workflowType="direct_resell"
                            requiresDilution={requiresDilution(item)}
                            status={status}
                            onStartInspection={() => handleSelectItem(item)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Complete all button when all items are done */}
        {Object.values(itemStatuses).filter(s => s === 'completed').length === filteredItems.length && 
         filteredItems.length > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={onStart}
              className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xl rounded-lg shadow-lg transform transition-all hover:scale-105"
            >
              <span className="flex items-center space-x-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Complete Order Inspection</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
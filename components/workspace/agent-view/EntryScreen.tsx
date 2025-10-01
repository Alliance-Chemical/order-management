'use client';

import React, { useState } from 'react';
import { EntryScreenProps } from '@/lib/types/agent-view';
import TaskListItem from './TaskListItem';
import { Button } from '../../ui/button';
import { UnifiedQRScanner } from '@/components/qr/UnifiedQRScanner';
import type { ValidatedQRData } from '@/hooks/useQRScanner';

interface OrderItem {
  lineItemKey?: string;
  sku?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  imageUrl?: string;
  orderItemId?: string;
}

export default function EntryScreen({ workspace, onStart, onSwitchToSupervisor, onSelectItem }: EntryScreenProps & { onSelectItem?: (item: OrderItem) => void }) {
  const [itemStatuses, setItemStatuses] = useState<Record<string, 'pending' | 'in_progress' | 'completed'>>({});
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [pendingItem, setPendingItem] = useState<OrderItem | null>(null);
  const [isValidatingQR, setIsValidatingQR] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [showFloatingButton, setShowFloatingButton] = useState(true);
  const shopifyCdnBase = process.env.NEXT_PUBLIC_SHOPIFY_CDN_BASE;

  // Estimated time based on workflow
  const getEstimatedTime = () => {
    const itemCount = getFilteredItems().length;
    if (workspace.workflowPhase === 'pre_mix') {
      return itemCount > 1 ? '~5 min' : '~3 min';
    } else if (workspace.workflowPhase === 'pre_ship') {
      return itemCount > 1 ? '~4 min' : '~2 min';
    }
    return '~3 min';
  };

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
  const getItemWorkflowType = () => {
    return workspace.workflowType || 'pump_and_fill';
  };
  
  // Handle QR scan completion
  const handleQRScanComplete = async (_data: ValidatedQRData) => {
    try {
      setIsValidatingQR(true);
      setQrError(null);

      // Validate QR data matches the current workspace
      if (_data.workspace && _data.workspace.orderId !== workspace.orderId) {
        setQrError(`QR code is for order ${_data.workspace.orderNumber}, but you're viewing order ${workspace.orderNumber}`);
        setIsValidatingQR(false);
        return;
      }

      // Small delay to show validation feedback
      await new Promise(resolve => setTimeout(resolve, 500));

      setShowQRScanner(false);
      setIsValidatingQR(false);

      // Now proceed with the inspection
      if (pendingItem && onSelectItem) {
        // Mark item as in progress
        setItemStatuses(prev => ({
          ...prev,
          [pendingItem.lineItemKey || pendingItem.sku || pendingItem.name]: 'in_progress'
        }));
        onSelectItem(pendingItem);
      } else {
        // Single item or general start
        onStart();
      }

      // Clear pending item
      setPendingItem(null);
    } catch (error) {
      console.error('Error validating QR:', error);
      setQrError(error instanceof Error ? error.message : 'Failed to validate QR code');
      setIsValidatingQR(false);
    }
  };

  // Handle item selection - now requires QR scan first
  const handleSelectItem = (item: OrderItem) => {
    // Store the item and show QR scanner
    setPendingItem(item);
    setShowQRScanner(true);
  };

  // Handle start inspection - now requires QR scan first
  const handleStartInspection = () => {
    setPendingItem(null);
    setShowQRScanner(true);
    setShowFloatingButton(false); // Hide floating button when starting
  };

  // Get filtered items (exclude discounts)
  const getFilteredItems = (): OrderItem[] => {
    if (!workspace.shipstationData?.items) return [];
    return workspace.shipstationData.items.filter((item: OrderItem) => 
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
        <div className="max-w-7xl mx-auto">
          {/* Small supervisor mode toggle in corner */}
          <div className="flex justify-end mb-4">
            <button
              onClick={onSwitchToSupervisor}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Switch to Supervisor View
            </button>
          </div>

          {/* Single item card - Samsung Tablet Landscape Optimized */}
          <div className="worker-card">
            {/* Phase Badge + Time Estimate (Top Bar) */}
            <div className="mb-6 flex items-center justify-between">
              <div className="inline-flex items-center px-6 py-3 bg-worker-blue text-white rounded-full">
                <span className="text-worker-xl font-bold">{getPhaseLabel()}</span>
              </div>
              <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lg font-bold">{getEstimatedTime()}</span>
              </div>
            </div>

            {/* Two-Column Layout for Landscape Tablets */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
              {/* Left Column: Product Image (40%) */}
              <div className="lg:col-span-2">
                {filteredItems[0] && (
                  <div className="flex justify-center lg:justify-start">
                    <div className="relative">
                      <img
                        src={filteredItems[0].imageUrl ||
                             (shopifyCdnBase && filteredItems[0].sku
                               ? `${shopifyCdnBase.replace(/\/$/, '')}/${filteredItems[0].sku.replace(/[^A-Za-z0-9_-]/g, '_')}.jpg`
                               : '/placeholder-chemical.png')}
                        alt={filteredItems[0].name || 'Product'}
                        className="w-64 h-64 lg:w-80 lg:h-80 object-cover rounded-2xl shadow-warehouse-lg border-4 border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-chemical.png';
                        }}
                        onClick={() => {
                          // Future: Open fullscreen image viewer
                          const target = event?.target as HTMLImageElement;
                          if (target?.requestFullscreen) {
                            target.requestFullscreen();
                          }
                        }}
                      />
                      {filteredItems[0].sku && (
                        <div className="absolute bottom-2 left-2 right-2 bg-black/75 text-white px-3 py-2 rounded-lg text-center">
                          <span className="text-sm font-bold">SKU: {filteredItems[0].sku}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Order Info + Actions (60%) */}
              <div className="lg:col-span-3">
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

              <div className="text-center lg:text-left">
                <div className="worker-label text-gray-600 mb-2">Fulfillment Method:</div>
                <div className="worker-text">
                  {getItemWorkflowType() === 'direct_resell' ? 'Ready to Ship' : 'Pump & Fill'}
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-start">
              <Button
                onClick={handleStartInspection}
                variant="go"
                size="xlarge"
                haptic="success"
                fullWidth
                icon={
                  <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" className="w-12 h-12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                }
              >
                <span className="text-warehouse-3xl font-black">{getButtonText()}</span>
              </Button>
            </div>
          </div>
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
              {filteredItems.map((item, idx) => {
                const workflowType = getItemWorkflowType();
                const status = itemStatuses[item.lineItemKey || item.sku || item.name] || 'pending';

                return (
                  <TaskListItem
                    key={item.lineItemKey || item.sku || `item-${idx}`}
                    item={{
                      lineItemId: item.orderItemId || item.lineItemKey,
                      sku: item.sku,
                      name: item.name || 'Unknown Product',
                      quantity: item.quantity || 1,
                      unitPrice: item.unitPrice,
                      imageUrl:
                        item.imageUrl ||
                        (shopifyCdnBase && item.sku
                          ? `${shopifyCdnBase.replace(/\/$/, '')}/${item.sku.replace(/[^A-Za-z0-9_-]/g, '_')}.jpg`
                          : undefined),
                    }}
                    workflowType={workflowType}
                    requiresDilution={false}
                    status={status}
                    onStartInspection={() => handleSelectItem(item)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* QR Error Display */}
      {qrError && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md">
          <div className="bg-red-500 text-white rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold">QR Scan Error</p>
                <p className="text-sm mt-1">{qrError}</p>
              </div>
              <button
                onClick={() => setQrError(null)}
                className="text-white hover:text-gray-200"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <>
          <UnifiedQRScanner
            onScan={(data) => {
              // For non-validated scans, we still accept them
              handleQRScanComplete({
                id: workspace.id,
                shortCode: data,
                type: 'workspace',
                workspace: {
                  id: workspace.id,
                  orderId: workspace.orderId,
                  orderNumber: workspace.orderNumber,
                  status: workspace.status,
                }
              } as ValidatedQRData);
            }}
            onValidatedScan={handleQRScanComplete}
            onClose={() => {
              setShowQRScanner(false);
              setPendingItem(null);
              setQrError(null);
            }}
            validateQR={true}
            allowManualEntry={true}
            title="Scan QR Code to Start Inspection"
          />

          {/* Loading Overlay during validation */}
          {isValidatingQR && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-lg font-semibold text-gray-900">Validating QR Code...</p>
                <p className="text-sm text-gray-600 mt-2">Please wait</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sticky Floating Action Button - Samsung Tablet Optimized */}
      {showFloatingButton && !showQRScanner && (
        <button
          onClick={handleStartInspection}
          className="fixed bottom-8 right-8 z-50 w-20 h-20 md:w-24 md:h-24 bg-warehouse-go hover:bg-warehouse-go/90 text-white rounded-full shadow-warehouse-xl flex items-center justify-center animate-pulse-strong active:scale-95 transition-transform"
          aria-label="Start Inspection"
        >
          <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

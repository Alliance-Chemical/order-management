'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, PrinterIcon, DocumentCheckIcon, BeakerIcon } from '@heroicons/react/24/solid';
import SourceContainerSelector from '../workspace/SourceContainerSelector';

interface FreightOrder {
  orderId: number;
  orderNumber: string;
  customerName?: string;
  items?: any[];
}

interface QRCode {
  id: string;
  code: string;
  type: 'master' | 'container' | 'pallet';
  label?: string;
  metadata?: any;
}

interface PrintPreparationModalProps {
  order: FreightOrder;
  onClose: () => void;
  onPrintComplete: () => void;
}

interface SourceAssignment {
  lineItemId: string;
  productName: string;
  quantity: number;
  workflowType: 'pump_and_fill' | 'direct_resell';
  sourceContainers: Array<{
    id: string;
    name: string;
  }>;
}

export default function PrintPreparationModal({ 
  order, 
  onClose, 
  onPrintComplete 
}: PrintPreparationModalProps) {
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [labelSummary, setLabelSummary] = useState<{
    master: number;
    source: number;
    drums: number;
    totes: number;
    pallets: number;
  }>({ master: 0, source: 0, drums: 0, totes: 0, pallets: 0 });
  
  // Source container assignment state
  const [sourceAssignments, setSourceAssignments] = useState<SourceAssignment[]>([]);
  const [selectingSourceFor, setSelectingSourceFor] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<'add' | 'replace'>('add');
  const [duplicatingSource, setDuplicatingSource] = useState<any | null>(null);

  useEffect(() => {
    fetchQRCodes();
    initializeSourceAssignments();
    fetchExistingSourceAssignments();
  }, [order.orderId]);

  const fetchExistingSourceAssignments = async () => {
    try {
      const response = await fetch(`/api/workspace/${order.orderId}/assign-source`);
      const data = await response.json();
      
      if (data.success && data.sourceAssignments && data.sourceAssignments.length > 0) {
        // Merge existing assignments with initialized ones
        setSourceAssignments(prevAssignments => {
          return prevAssignments.map(assignment => {
            const existing = data.sourceAssignments.find((sa: any) => 
              sa.lineItemId === assignment.lineItemId
            );
            if (existing) {
              return {
                ...assignment,
                workflowType: existing.workflowType || 'pump_and_fill',
                sourceContainers: existing.sourceContainers || []
              };
            }
            return assignment;
          });
        });
      }
    } catch (error) {
      console.error('Failed to fetch existing source assignments:', error);
    }
  };

  const initializeSourceAssignments = () => {
    // Parse order items to create source assignment requirements
    const assignments: SourceAssignment[] = [];
    
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        const productName = item.name || '';
        
        // Initialize each item with default workflow type
        assignments.push({
          lineItemId: item.orderItemId || item.lineItemKey || `item-${assignments.length}`,
          productName: productName,
          quantity: item.quantity || 1,
          workflowType: 'pump_and_fill', // Default to pump_and_fill
          sourceContainers: []
        });
      });
    }
    
    setSourceAssignments(assignments);
  };

  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/workspace/${order.orderId}/qrcodes`);
      const data = await response.json();
      
      if (data.success) {
        console.log('[DEBUG] Raw QR codes from API:', data.qrCodes);
        
        // Normalize server QR records into a consistent shape the UI expects
        const normalized = (data.qrCodes || []).map((qr: any) => {
          // Server returns qrType, not type - keep both for compatibility
          const qrType = qr.qrType || qr.type || qr.qrtype || '';
          const meta = qr.metadata || qr.encodedData || {};
          const containerType = meta.containerType || meta.container_type || meta.type || undefined;
          return {
            ...qr,
            type: qrType,  // Set type for backward compatibility
            qrType: qrType,  // Keep qrType as primary field
            metadata: { ...meta, containerType },
            encodedData: qr.encodedData || meta  // Ensure encodedData is available
          } as QRCode & { metadata: any };
        });

        console.log('[DEBUG] Normalized QR codes:', normalized);
        setQrCodes(normalized);
        
        // Calculate label summary based on QR codes
        const summary = {
          master: 0,
          source: 0,
          drums: 0,
          totes: 0,
          pallets: 0
        };

        // Count QR codes by type
        normalized.forEach((qr: any, index: number) => {
          const qrType = qr.qrType || qr.type || '';
          console.log(`[DEBUG] Processing QR ${index}:`, {
            qrType,
            encodedData: qr.encodedData,
            metadata: qr.metadata
          });
          
          if (qrType === 'master' || qrType === 'order_master') {
            // Check both metadata and encodedData for isSource flag
            const isSource = qr.encodedData?.isSource || qr.metadata?.isSource;
            if (isSource) {
              console.log('[DEBUG] Found source QR');
              summary.source++;
            } else {
              console.log('[DEBUG] Found master QR');
              summary.master++;
            }
          } else if (qrType === 'container') {
            // Check both metadata and encodedData for containerType
            const containerType = qr.encodedData?.containerType || qr.metadata?.containerType;
            console.log('[DEBUG] Found container QR with type:', containerType);
            if (containerType === 'drum') {
              summary.drums++;
            } else if (containerType === 'tote') {
              summary.totes++;
            } else {
              // Default containers to drums if type not specified
              summary.drums++;
            }
          } else if (qrType === 'pallet') {
            summary.pallets++;
          }
        });

        console.log('[DEBUG] Final label summary:', summary);
        setLabelSummary(summary);
      }
    } catch (error) {
      console.error('Error fetching QR codes:', error);
      alert('Failed to fetch QR codes');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkflowTypeChange = async (lineItemId: string, newWorkflowType: 'pump_and_fill' | 'direct_resell') => {
    // Update local state
    setSourceAssignments(prev => prev.map(assignment => {
      if (assignment.lineItemId === lineItemId) {
        return {
          ...assignment,
          workflowType: newWorkflowType,
          sourceContainers: newWorkflowType === 'direct_resell' ? [] : assignment.sourceContainers
        };
      }
      return assignment;
    }));

    // Save to backend
    const assignment = sourceAssignments.find(a => a.lineItemId === lineItemId);
    if (assignment) {
      try {
        await fetch(`/api/workspace/${order.orderId}/assign-source`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: order.orderId,
            lineItemId,
            productName: assignment.productName,
            workflowType: newWorkflowType,
            sourceContainerId: newWorkflowType === 'direct_resell' ? 'DIRECT' : undefined,
            sourceContainerName: newWorkflowType === 'direct_resell' ? 'Direct Resell' : undefined,
            mode: 'replace'
          })
        });
      } catch (error) {
        console.error('Failed to save workflow type:', error);
      }
    }
  };

  const handleSourceSelection = async (lineItemId: string, containers: any[]) => {
    const assignment = sourceAssignments.find(a => a.lineItemId === lineItemId);
    if (!assignment) return;

    if (containers.length > 0) {
      // Handle multiple containers (for duplicates)
      const newContainers = containers.map(container => ({
        id: container.id,
        name: `${container.containerType} #${container.shortCode} - ${container.productTitle}`,
        ...container
      }));
      
      // Update local state
      setSourceAssignments(prev => prev.map(assignment => {
        if (assignment.lineItemId === lineItemId) {
          if (editingMode === 'replace') {
            // Replace all existing containers
            return {
              ...assignment,
              sourceContainers: newContainers
            };
          } else {
            // Add to existing containers
            return {
              ...assignment,
              sourceContainers: [...assignment.sourceContainers, ...newContainers]
            };
          }
        }
        return assignment;
      }));
      
      // Save each container to backend
      for (const container of containers) {
        try {
          await fetch(`/api/workspace/${order.orderId}/assign-source`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceId: order.orderId,
              lineItemId,
              productName: assignment.productName,
              workflowType: assignment.workflowType,
              sourceContainerId: container.id,
              sourceContainerName: `${container.containerType} #${container.shortCode}`,
              mode: editingMode // Send mode to backend
            })
          });
        } catch (error) {
          console.error('Failed to save source assignment:', error);
        }
      }
    }
    
    setSelectingSourceFor(null);
    setEditingMode('add'); // Reset to add mode
    setDuplicatingSource(null); // Clear duplicate source
  };

  // Check if all items meet their workflow requirements
  const allItemsReady = sourceAssignments.every(assignment => {
    if (assignment.workflowType === 'direct_resell') {
      return true; // Direct resell items don't need source containers
    } else {
      return assignment.sourceContainers.length > 0; // Pump & fill items need at least one source
    }
  });

  const handlePrintAll = async () => {
    // Check if all items are ready
    if (!allItemsReady) {
      alert('Please complete all item assignments before printing. Pump & Fill items need source containers.');
      return;
    }

    setPrinting(true);
    try {
      // Filter QR codes based on individual item workflow types
      // Only include source QR if at least one item is pump_and_fill
      const hasPumpAndFill = sourceAssignments.some(a => a.workflowType === 'pump_and_fill');
      const qrCodesToPrint = hasPumpAndFill 
        ? qrCodes // Include all QR codes including source
        : qrCodes.filter(qr => !qr.metadata?.isSource); // Exclude source for all-direct-resell orders
      
      const response = await fetch('/api/qr/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qrCodes: qrCodesToPrint,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          sourceAssignments: sourceAssignments // Include source assignments with workflow types
        })
      });

      if (!response.ok) {
        throw new Error('Print failed');
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labels-${order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Show success message
      alert(`Labels printed successfully for Order ${order.orderNumber}`);
      onPrintComplete();
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to print labels');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Order Assignment & Label Printing
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading label information...</p>
            </div>
          ) : (
            <>
              {/* Order Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <DocumentCheckIcon className="h-6 w-6 text-blue-600 mr-3 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Order #{order.orderNumber}
                    </h3>
                    <p className="text-gray-700 mt-1">
                      Customer: {order.customerName || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Item-by-Item Workflow Assignment */}
              {sourceAssignments.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <BeakerIcon className="h-6 w-6 mr-2 text-blue-600" />
                    Fulfillment Method & Source Assignment
                  </h3>
                  <div className="space-y-4">
                    {sourceAssignments.map((assignment) => (
                      <div key={assignment.lineItemId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        {/* Item Header */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-lg">
                              {assignment.quantity}x {assignment.productName}
                            </p>
                          </div>
                        </div>
                        
                        {/* Workflow Type Toggle for this item */}
                        <div className="mb-3">
                          <label className="text-sm font-medium text-gray-600 mb-2 block">Fulfillment Method:</label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleWorkflowTypeChange(assignment.lineItemId, 'pump_and_fill')}
                              className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                                assignment.workflowType === 'pump_and_fill'
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                              }`}
                            >
                              🏭 Pump & Fill
                            </button>
                            <button
                              onClick={() => handleWorkflowTypeChange(assignment.lineItemId, 'direct_resell')}
                              className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                                assignment.workflowType === 'direct_resell'
                                  ? 'border-green-500 bg-green-50 text-green-700'
                                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                              }`}
                            >
                              📦 Direct Resell
                            </button>
                          </div>
                        </div>
                        
                        {/* Show source assignment section only for pump_and_fill items */}
                        {assignment.workflowType === 'pump_and_fill' && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            {assignment.sourceContainers.length > 0 ? (
                              <div className="mt-1">
                                {assignment.sourceContainers.map((container, idx) => {
                                  // Extract concentrations for dilution check
                                  const sourceConc = parseFloat(container.name.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] || '0');
                                  const targetConc = parseFloat(assignment.productName.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] || '0');
                                  const needsDilution = sourceConc > 0 && targetConc > 0 && sourceConc > targetConc;
                                  
                                  return (
                                    <div key={idx}>
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm text-green-600">
                                          ✓ Source {idx + 1}: {container.name}
                                        </p>
                                        <button
                                          onClick={() => {
                                            setDuplicatingSource(container);
                                            setEditingMode('add');
                                            setSelectingSourceFor(assignment.lineItemId);
                                          }}
                                          className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                          title="Duplicate this source container"
                                        >
                                          + Duplicate
                                        </button>
                                      </div>
                                      {needsDilution && (
                                        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                                          <p className="text-sm text-orange-800 font-medium">
                                            ⚠ Dilution Required: {sourceConc}% → {targetConc}%
                                          </p>
                                          <button
                                            onClick={() => {
                                              // Open dilution calculator with parameters
                                              const chemName = container.name.split(/\d+(?:\.\d+)?\s*%/)[0].trim();
                                              
                                              // Find destination QR codes for this line item
                                              const destinationQRs = qrCodes.filter(qr => 
                                                qr.type === 'container' && 
                                                qr.encodedData?.itemId === assignment.lineItemId
                                              ).map(qr => qr.encodedData?.shortCode || qr.shortCode).filter(Boolean);
                                              
                                              const dilutionUrl = `/dilution-calculator?chem=${encodeURIComponent(chemName)}&ic=${sourceConc}&dc=${targetConc}&target=${assignment.quantity}&orderId=${order.orderId}&destQRs=${encodeURIComponent(JSON.stringify(destinationQRs))}&return=${encodeURIComponent(window.location.pathname)}`;
                                              window.open(dilutionUrl, '_blank');
                                            }}
                                            className="mt-1 px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                                          >
                                            Calculate Dilution →
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-red-600 mt-1">
                                ⚠ No source assigned
                              </p>
                            )}
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => {
                                  setEditingMode('add');
                                  setSelectingSourceFor(assignment.lineItemId);
                                }}
                                className="px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 text-sm"
                                title="Add another source container"
                              >
                                + Add Source
                              </button>
                              {assignment.sourceContainers.length > 0 && (
                                <button
                                  onClick={() => {
                                    setEditingMode('replace');
                                    setSelectingSourceFor(assignment.lineItemId);
                                  }}
                                  className="px-4 py-2 rounded-lg font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
                                  title="Replace all source containers"
                                >
                                  Replace All
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Show checkmark for direct resell items */}
                        {assignment.workflowType === 'direct_resell' && (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-700 font-medium">
                              ✓ Ready for Direct Resell - No source assignment needed
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {!allItemsReady && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Important:</strong> All Pump & Fill items must have source containers assigned before labels can be printed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Source Container Selector Modal */}
              {selectingSourceFor && (() => {
                const selectedItem = sourceAssignments.find(a => a.lineItemId === selectingSourceFor);
                return (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
                      <div className="p-4 border-b bg-gray-50">
                        <h3 className="text-lg font-semibold mb-2">Select Source Container</h3>
                        {/* Prominent display of the item being assigned */}
                        <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-3 mt-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-blue-600 text-white rounded-full px-3 py-1 text-sm font-bold">
                              ITEM
                            </div>
                            <div className="flex-1">
                              <p className="text-lg font-bold text-blue-900">
                                {selectedItem?.quantity || 0}x {selectedItem?.productName || 'Unknown Item'}
                              </p>
                              <p className="text-sm text-blue-700 mt-1">
                                You are selecting a source container for this destination item
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 overflow-y-auto max-h-[60vh]">
                        <SourceContainerSelector
                          productName={selectedItem?.productName || ''}
                          quantity={selectedItem?.quantity || 1}
                          existingSource={duplicatingSource}
                          onSelect={(containers) => handleSourceSelection(selectingSourceFor, containers)}
                        />
                      </div>
                      <div className="p-4 border-t flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Tip:</span> Ensure the source chemical matches the destination requirement
                        </div>
                        <button
                          onClick={() => {
                            setSelectingSourceFor(null);
                            setDuplicatingSource(null);
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Label Summary */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Labels to Print
                </h3>
                <div className="space-y-3">
                  {labelSummary.master > 0 && (
                    <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                      <span className="text-gray-700">Master Label</span>
                      <span className="font-semibold text-gray-900">
                        {labelSummary.master} label{labelSummary.master > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  
                  {(() => {
                    // Only show source labels if there are pump_and_fill items
                    const hasPumpAndFill = sourceAssignments.some(a => a.workflowType === 'pump_and_fill');
                    if (!hasPumpAndFill) {
                      return null; // No source labels needed if all items are direct resell
                    }
                    
                    // Calculate actual source label count from pump_and_fill assignments only
                    const totalSourceContainers = sourceAssignments
                      .filter(a => a.workflowType === 'pump_and_fill')
                      .reduce((total, assignment) => total + assignment.sourceContainers.length, 0);
                    
                    if (totalSourceContainers > 0) {
                      return (
                        <div className="flex justify-between items-center bg-yellow-50 rounded-lg px-4 py-3">
                          <span className="text-gray-700">Source Container Label{totalSourceContainers > 1 ? 's' : ''} (Pump & Fill)</span>
                          <span className="font-semibold text-gray-900">
                            {totalSourceContainers} label{totalSourceContainers > 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    }
                    // Fallback to original source count from QR codes if no assignments yet
                    if (labelSummary.source > 0 && hasPumpAndFill) {
                      return (
                        <div className="flex justify-between items-center bg-yellow-50 rounded-lg px-4 py-3">
                          <span className="text-gray-700">Source Container Label</span>
                          <span className="font-semibold text-gray-900">
                            {labelSummary.source} label{labelSummary.source > 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {labelSummary.drums > 0 && (
                    <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                      <span className="text-gray-700">Container Labels</span>
                      <span className="font-semibold text-gray-900">
                        {labelSummary.drums} label{labelSummary.drums > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  
                  {labelSummary.totes > 0 && (
                    <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                      <span className="text-gray-700">Tote Labels</span>
                      <span className="font-semibold text-gray-900">
                        {labelSummary.totes} labels
                      </span>
                    </div>
                  )}
                  
                  {labelSummary.pallets > 0 && (
                    <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                      <span className="text-gray-700">Pallet Labels</span>
                      <span className="font-semibold text-gray-900">
                        {labelSummary.pallets} labels
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">
                      Total Labels
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {(() => {
                        // Calculate actual source count from pump_and_fill assignments only
                        const actualSourceCount = sourceAssignments
                          .filter(a => a.workflowType === 'pump_and_fill')
                          .reduce((total, assignment) => total + assignment.sourceContainers.length, 0);
                        
                        return labelSummary.master + actualSourceCount + labelSummary.drums + 
                               labelSummary.totes + labelSummary.pallets || qrCodes.length;
                      })()}
                    </span>
                  </div>
                </div>
                
                {/* Note about label count */}
                <div className="mt-3 text-sm text-gray-600">
                  <p className="italic">
                    Label count is based on order items. For "15 Gallon" drums, we generate 1 label per drum.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePrintAll}
                  disabled={printing || qrCodes.length === 0 || !allItemsReady}
                  className={`inline-flex items-center px-6 py-3 font-semibold rounded-lg shadow-sm transition-colors ${
                    allItemsReady && !printing && qrCodes.length > 0
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                  title={!allItemsReady ? 'Please complete all item assignments' : ''}
                >
                  <PrinterIcon className="h-5 w-5 mr-2" />
                  {printing ? 'Printing...' : 'Confirm & Print All Labels'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
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
  
  // Workflow type state
  const [workflowType, setWorkflowType] = useState<'pump_and_fill' | 'direct_resell'>('pump_and_fill');
  
  // Source container assignment state
  const [sourceAssignments, setSourceAssignments] = useState<SourceAssignment[]>([]);
  const [selectingSourceFor, setSelectingSourceFor] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<'add' | 'replace'>('add');

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
            const existing = data.sourceAssignments.filter((sa: any) => 
              sa.lineItemId === assignment.lineItemId
            );
            if (existing.length > 0) {
              return {
                ...assignment,
                sourceContainers: existing.map((e: any) => ({
                  id: e.sourceContainerId,
                  name: e.sourceContainerName
                }))
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
        
        // For pump & fill workflow, ALL items need source assignment
        // Every single item needs to specify where it's being pumped from
        assignments.push({
          lineItemId: item.orderItemId || item.lineItemKey || `item-${assignments.length}`,
          productName: productName,
          quantity: item.quantity || 1,
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

  const handleSourceSelection = async (lineItemId: string, containers: any[]) => {
    if (containers.length > 0) {
      const container = containers[0]; // Take first selected container
      
      // Update local state
      setSourceAssignments(prev => prev.map(assignment => {
        if (assignment.lineItemId === lineItemId) {
          const newContainer = {
            id: container.id,
            name: `${container.containerType} #${container.shortCode} - ${container.productTitle}`
          };
          
          if (editingMode === 'replace') {
            // Replace all existing containers
            return {
              ...assignment,
              sourceContainers: [newContainer]
            };
          } else {
            // Add to existing containers
            return {
              ...assignment,
              sourceContainers: [...assignment.sourceContainers, newContainer]
            };
          }
        }
        return assignment;
      }));
      
      // Save to backend
      try {
        await fetch(`/api/workspace/${order.orderId}/assign-source`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: order.orderId,
            lineItemId,
            sourceContainerId: container.id,
            sourceContainerName: `${container.containerType} #${container.shortCode}`,
            mode: editingMode // Send mode to backend
          })
        });
      } catch (error) {
        console.error('Failed to save source assignment:', error);
      }
    }
    
    setSelectingSourceFor(null);
    setEditingMode('add'); // Reset to add mode
  };

  // For Direct Resell, no source assignment needed
  const allSourcesAssigned = workflowType === 'direct_resell' 
    ? true 
    : sourceAssignments.every(a => a.sourceContainers.length > 0);

  const handlePrintAll = async () => {
    // Check if all sources are assigned
    if (!allSourcesAssigned) {
      alert('Please assign source containers for all items before printing.');
      return;
    }

    setPrinting(true);
    try {
      // For Direct Resell, filter out source QR codes
      const qrCodesToPrint = workflowType === 'direct_resell' 
        ? qrCodes.filter(qr => !qr.metadata?.isSource)
        : qrCodes;
      
      const response = await fetch('/api/qr/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qrCodes: qrCodesToPrint,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          sourceAssignments: sourceAssignments, // Include source assignments
          workflowType: workflowType // Pass workflow type
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
        <div className="p-6">
          {/* Workflow Type Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              How will this order be fulfilled?
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setWorkflowType('pump_and_fill')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  workflowType === 'pump_and_fill'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-2">🏭</div>
                <div className="font-semibold text-gray-900">Pump & Fill</div>
                <div className="text-sm text-gray-600 mt-1">
                  Transfer from bulk source to new containers
                </div>
              </button>
              <button
                onClick={() => setWorkflowType('direct_resell')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  workflowType === 'direct_resell'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-2">📦</div>
                <div className="font-semibold text-gray-900">Direct Resell</div>
                <div className="text-sm text-gray-600 mt-1">
                  Ship existing pre-packaged containers
                </div>
              </button>
            </div>
          </div>

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

              {/* Source Container Assignment Section - Only for Pump & Fill */}
              {workflowType === 'pump_and_fill' && sourceAssignments.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <BeakerIcon className="h-6 w-6 mr-2 text-blue-600" />
                    Source Container Assignment
                  </h3>
                  <div className="space-y-3">
                    {sourceAssignments.map((assignment) => (
                      <div key={assignment.lineItemId} className="bg-gray-50 rounded-lg px-4 py-3">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {assignment.quantity}x {assignment.productName}
                            </p>
                            {assignment.sourceContainers.length > 0 ? (
                              <div className="mt-1">
                                {assignment.sourceContainers.map((container, idx) => (
                                  <p key={idx} className="text-sm text-green-600">
                                    ✓ Source {idx + 1}: {container.name}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-red-600 mt-1">
                                ⚠ No source assigned
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingMode('add');
                                setSelectingSourceFor(assignment.lineItemId);
                              }}
                              className="px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
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
                                className="px-4 py-2 rounded-lg font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                                title="Replace all source containers"
                              >
                                Replace All
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {!allSourcesAssigned && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Important:</strong> All items must have source containers assigned before labels can be printed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Source Container Selector Modal */}
              {selectingSourceFor && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                  <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
                    <div className="p-4 border-b">
                      <h3 className="text-lg font-semibold">Select Source Container</h3>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[60vh]">
                      <SourceContainerSelector
                        productName={sourceAssignments.find(a => a.lineItemId === selectingSourceFor)?.productName || ''}
                        quantity={sourceAssignments.find(a => a.lineItemId === selectingSourceFor)?.quantity || 1}
                        onSelect={(containers) => handleSourceSelection(selectingSourceFor, containers)}
                      />
                    </div>
                    <div className="p-4 border-t">
                      <button
                        onClick={() => setSelectingSourceFor(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                  
                  {labelSummary.source > 0 && (
                    <div className="flex justify-between items-center bg-yellow-50 rounded-lg px-4 py-3">
                      <span className="text-gray-700">Source Container Label</span>
                      <span className="font-semibold text-gray-900">
                        {labelSummary.source} label{labelSummary.source > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  
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
                      {(labelSummary.master + labelSummary.source + labelSummary.drums + 
                       labelSummary.totes + labelSummary.pallets) || qrCodes.length}
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
                  disabled={printing || qrCodes.length === 0 || !allSourcesAssigned}
                  className={`inline-flex items-center px-6 py-3 font-semibold rounded-lg shadow-sm transition-colors ${
                    allSourcesAssigned && !printing && qrCodes.length > 0
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                  title={!allSourcesAssigned ? 'Please assign source containers for all items' : ''}
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
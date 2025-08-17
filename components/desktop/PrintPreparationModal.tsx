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
  type: 'master' | 'container' | 'pallet' | 'source';
  label?: string;
  metadata?: any;
  shortCode?: string;
  qrType?: string;
  encodedData?: any;
  sourceContainerId?: string;
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
  const [editingSourceIndex, setEditingSourceIndex] = useState<number | null>(null);
  const [gradeMismatchWarning, setGradeMismatchWarning] = useState<{
    show: boolean;
    sourceGrade: string;
    destinationGrade: string;
    containers: any[];
    lineItemId: string;
  } | null>(null);

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

  // Grade detection helper functions
  const extractGrade = (productName: string): string => {
    const gradePatterns = [
      { pattern: /\b(USP|usp)\b/i, grade: 'USP' },
      { pattern: /\b(FCC|fcc)\b/i, grade: 'FCC' },
      { pattern: /\b(Food Grade|food grade|FOOD)\b/i, grade: 'Food Grade' },
      { pattern: /\b(ACS|acs)\b/i, grade: 'ACS' },
      { pattern: /\b(Reagent|reagent)\b/i, grade: 'Reagent' },
      { pattern: /\b(Tech|tech|Technical)\b/i, grade: 'Tech' },
      { pattern: /\b(Industrial|industrial)\b/i, grade: 'Industrial' },
      { pattern: /\b(Lab|lab|Laboratory)\b/i, grade: 'Lab' }
    ];
    
    for (const { pattern, grade } of gradePatterns) {
      if (pattern.test(productName)) {
        return grade;
      }
    }
    return 'Standard';
  };

  const areGradesCompatible = (sourceGrade: string, destGrade: string): boolean => {
    // Define grade compatibility rules
    const foodGrades = ['USP', 'FCC', 'Food Grade'];
    const reagentGrades = ['ACS', 'Reagent'];
    const techGrades = ['Tech', 'Industrial', 'Lab'];
    
    // If grades are exactly the same, they're compatible
    if (sourceGrade === destGrade) return true;
    
    // Food grades are compatible with each other
    if (foodGrades.includes(sourceGrade) && foodGrades.includes(destGrade)) {
      return true;
    }
    
    // Reagent grades are compatible with each other
    if (reagentGrades.includes(sourceGrade) && reagentGrades.includes(destGrade)) {
      return true;
    }
    
    // Tech grades are compatible with each other
    if (techGrades.includes(sourceGrade) && techGrades.includes(destGrade)) {
      return true;
    }
    
    // Standard grade is compatible with tech grades
    if ((sourceGrade === 'Standard' || destGrade === 'Standard') && 
        (techGrades.includes(sourceGrade) || techGrades.includes(destGrade))) {
      return true;
    }
    
    return false;
  };

  const handleSourceSelection = async (lineItemId: string, containers: any[]) => {
    const assignment = sourceAssignments.find(a => a.lineItemId === lineItemId);
    if (!assignment) return;

    if (containers.length > 0) {
      // Check for grade mismatch
      const destinationGrade = extractGrade(assignment.productName);
      const sourceGrade = extractGrade(containers[0].productTitle || containers[0].name || '');
      
      if (!areGradesCompatible(sourceGrade, destinationGrade)) {
        // Show warning modal
        setGradeMismatchWarning({
          show: true,
          sourceGrade,
          destinationGrade,
          containers,
          lineItemId
        });
        return; // Don't proceed with assignment yet
      }
      
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
              sourceContainerName: `${container.containerType} #${container.shortCode} - ${container.productTitle}`,
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
    setEditingSourceIndex(null); // Clear editing index
  };

  const handleConfirmGradeMismatch = async () => {
    if (!gradeMismatchWarning) return;
    
    const { containers, lineItemId } = gradeMismatchWarning;
    const assignment = sourceAssignments.find(a => a.lineItemId === lineItemId);
    if (!assignment) return;
    
    // Proceed with the assignment despite the mismatch
    const newContainers = containers.map(container => ({
      id: container.id,
      name: `${container.containerType} #${container.shortCode} - ${container.productTitle}`,
      ...container
    }));
    
    // Update local state
    setSourceAssignments(prev => prev.map(assignment => {
      if (assignment.lineItemId === lineItemId) {
        if (editingMode === 'replace' && editingSourceIndex !== null) {
          // Editing a specific source container
          const updatedContainers = [...assignment.sourceContainers];
          updatedContainers[editingSourceIndex] = newContainers[0]; // Replace the specific container
          return {
            ...assignment,
            sourceContainers: updatedContainers
          };
        } else if (editingMode === 'replace') {
          // Replace all containers
          return {
            ...assignment,
            sourceContainers: newContainers
          };
        } else {
          // Add mode - append new containers
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
            sourceContainerName: `${container.containerType} #${container.shortCode} - ${container.productTitle}`,
            mode: editingMode
          })
        });
      } catch (error) {
        console.error('Failed to save source assignment:', error);
      }
    }
    
    setGradeMismatchWarning(null);
    setSelectingSourceFor(null);
    setEditingMode('add');
    setDuplicatingSource(null);
    setEditingSourceIndex(null);
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
      // Refresh QR codes to get any newly created source QRs
      const qrResponse = await fetch(`/api/workspace/${order.orderId}/qrcodes`);
      const qrData = await qrResponse.json();
      
      if (!qrData.success) {
        throw new Error('Failed to fetch updated QR codes');
      }
      
      // Normalize the updated QR codes
      const updatedQRCodes = (qrData.qrCodes || []).map((qr: any) => {
        const qrType = qr.qrType || qr.type || qr.qrtype || '';
        const meta = qr.metadata || qr.encodedData || {};
        const containerType = meta.containerType || meta.container_type || meta.type || undefined;
        return {
          ...qr,
          type: qrType,
          qrType: qrType,
          metadata: { ...meta, containerType },
          encodedData: qr.encodedData || meta
        } as QRCode & { metadata: any };
      });
      
      // Filter QR codes based on individual item workflow types
      // Include source QRs for pump_and_fill items
      const hasPumpAndFill = sourceAssignments.some(a => a.workflowType === 'pump_and_fill');
      
      let qrCodesToPrint = updatedQRCodes;
      
      if (hasPumpAndFill) {
        // For pump & fill, include master + source QRs for assigned containers + container QRs
        const assignedSourceIds = sourceAssignments
          .filter(a => a.workflowType === 'pump_and_fill')
          .flatMap(a => a.sourceContainers.map((sc: any) => sc.id));
        
        qrCodesToPrint = updatedQRCodes.filter((qr: any) => {
          // Include master QR
          if (qr.qrType === 'order_master' && !qr.encodedData?.isSource) return true;
          // Include source QRs for assigned source containers
          if (qr.qrType === 'source' && qr.sourceContainerId && assignedSourceIds.includes(qr.sourceContainerId)) return true;
          // Include container QRs
          if (qr.qrType === 'container') return true;
          return false;
        });
      } else {
        // For all-direct-resell orders, exclude all source QRs
        qrCodesToPrint = updatedQRCodes.filter((qr: any) => 
          qr.qrType !== 'source' && !qr.metadata?.isSource && !qr.encodedData?.isSource
        );
      }
      
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
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => {
                                              // Edit functionality - open selector with current source pre-selected
                                              setDuplicatingSource(container);
                                              setEditingSourceIndex(idx);
                                              setEditingMode('replace');
                                              setSelectingSourceFor(assignment.lineItemId);
                                            }}
                                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                            title="Edit this source container"
                                          >
                                            ✏️ Edit
                                          </button>
                                          <button
                                            onClick={() => {
                                              setDuplicatingSource(container);
                                              setEditingSourceIndex(null); // Clear any editing state
                                              setEditingMode('add');
                                              setSelectingSourceFor(assignment.lineItemId);
                                            }}
                                            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                            title="Duplicate this source container"
                                          >
                                            📋 Duplicate
                                          </button>
                                          <button
                                            onClick={async () => {
                                              // Delete this specific source container
                                              const updatedContainers = assignment.sourceContainers.filter((_, i) => i !== idx);
                                              
                                              // Update local state
                                              setSourceAssignments(prev => prev.map(a => {
                                                if (a.lineItemId === assignment.lineItemId) {
                                                  return { ...a, sourceContainers: updatedContainers };
                                                }
                                                return a;
                                              }));
                                              
                                              // Update backend - replace with new list
                                              try {
                                                // First clear all sources
                                                await fetch(`/api/workspace/${order.orderId}/assign-source`, {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    lineItemId: assignment.lineItemId,
                                                    productName: assignment.productName,
                                                    workflowType: 'pump_and_fill',
                                                    sourceContainerId: '',
                                                    sourceContainerName: '',
                                                    mode: 'replace'
                                                  })
                                                });
                                                
                                                // Then add back the remaining sources
                                                for (const remainingContainer of updatedContainers) {
                                                  await fetch(`/api/workspace/${order.orderId}/assign-source`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                      lineItemId: assignment.lineItemId,
                                                      productName: assignment.productName,
                                                      workflowType: 'pump_and_fill',
                                                      sourceContainerId: remainingContainer.id,
                                                      sourceContainerName: remainingContainer.name,
                                                      mode: 'add'
                                                    })
                                                  });
                                                }
                                              } catch (error) {
                                                console.error('Failed to delete source:', error);
                                                alert('Failed to delete source container');
                                              }
                                            }}
                                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                            title="Delete this source container"
                                          >
                                            🗑️ Delete
                                          </button>
                                        </div>
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
                                              
                                              // Calculate total volume based on container size
                                              const productName = assignment.productName.toLowerCase();
                                              let totalVolume = assignment.quantity; // Default to quantity
                                              
                                              // Extract container size from product name
                                              if (productName.includes('gallon') || productName.includes('gal')) {
                                                const gallonMatch = productName.match(/(\d+(?:\.\d+)?)\s*(?:gallon|gal)/i);
                                                if (gallonMatch) {
                                                  const gallonsPerContainer = parseFloat(gallonMatch[1]);
                                                  totalVolume = assignment.quantity * gallonsPerContainer;
                                                }
                                              } else if (productName.includes('liter') || productName.includes('l')) {
                                                const literMatch = productName.match(/(\d+(?:\.\d+)?)\s*(?:liter|l)/i);
                                                if (literMatch) {
                                                  const litersPerContainer = parseFloat(literMatch[1]);
                                                  // Convert liters to gallons (1 liter = 0.264172 gallons)
                                                  totalVolume = assignment.quantity * litersPerContainer * 0.264172;
                                                }
                                              } else if (productName.includes('drum')) {
                                                // Standard drum is 55 gallons
                                                totalVolume = assignment.quantity * 55;
                                              } else if (productName.includes('tote')) {
                                                // Standard tote is 275 gallons
                                                totalVolume = assignment.quantity * 275;
                                              } else if (productName.includes('pail')) {
                                                // Standard pail is 5 gallons unless specified
                                                totalVolume = assignment.quantity * 5;
                                              }
                                              
                                              // Find destination QR codes for this line item
                                              const destinationQRs = qrCodes.filter(qr => 
                                                qr.type === 'container' && 
                                                qr.encodedData?.itemId === assignment.lineItemId
                                              ).map(qr => qr.encodedData?.shortCode || qr.shortCode).filter(Boolean);
                                              
                                              const dilutionUrl = `/dilution-calculator?chem=${encodeURIComponent(chemName)}&ic=${sourceConc}&dc=${targetConc}&target=${totalVolume}&orderId=${order.orderId}&destQRs=${encodeURIComponent(JSON.stringify(destinationQRs))}&return=${encodeURIComponent(window.location.pathname)}`;
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
                            setEditingSourceIndex(null);
                            setEditingMode('add');
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

              {/* Grade Mismatch Warning Modal */}
              {gradeMismatchWarning?.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
                  <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
                    <div className="p-6">
                      {/* Warning Icon */}
                      <div className="flex justify-center mb-4">
                        <div className="bg-red-100 rounded-full p-4">
                          <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-xl font-bold text-center text-gray-900 mb-4">
                        ⚠️ Chemical Grade Mismatch Detected
                      </h3>
                      
                      {/* Grade Information */}
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Destination Grade:</span>
                            <span className="font-bold text-red-800">{gradeMismatchWarning.destinationGrade}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Source Grade:</span>
                            <span className="font-bold text-red-800">{gradeMismatchWarning.sourceGrade}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Special warning for food grade */}
                      {['USP', 'FCC', 'Food Grade'].includes(gradeMismatchWarning.destinationGrade) && (
                        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3 mb-4">
                          <p className="text-sm font-bold text-yellow-800">
                            🚨 CRITICAL: Food/Pharmaceutical Grade Required
                          </p>
                          <p className="text-sm text-yellow-700 mt-1">
                            This destination requires {gradeMismatchWarning.destinationGrade} grade chemical. 
                            Using {gradeMismatchWarning.sourceGrade} grade may violate food safety regulations.
                          </p>
                        </div>
                      )}
                      
                      {/* General warning message */}
                      <p className="text-gray-600 mb-6">
                        The source container's grade ({gradeMismatchWarning.sourceGrade}) does not match 
                        the destination requirement ({gradeMismatchWarning.destinationGrade}). 
                        This may affect product quality or compliance.
                      </p>
                      
                      {/* Action buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setGradeMismatchWarning(null);
                            // Keep the selector open to choose a different source
                          }}
                          className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                        >
                          Choose Different Source
                        </button>
                        <button
                          onClick={handleConfirmGradeMismatch}
                          className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                        >
                          Override & Continue
                        </button>
                      </div>
                      
                      <p className="text-xs text-gray-500 text-center mt-3">
                        Override only if you have supervisor approval
                      </p>
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
                  
                  {(() => {
                    // Only show source labels if there are pump_and_fill items
                    const hasPumpAndFill = sourceAssignments.some(a => a.workflowType === 'pump_and_fill');
                    if (!hasPumpAndFill) {
                      return null; // No source labels needed if all items are direct resell
                    }
                    
                    // Count source labels for pump & fill items
                    const pumpAndFillItems = sourceAssignments.filter(a => a.workflowType === 'pump_and_fill');
                    const uniqueSourceContainers = new Set<string>();
                    
                    pumpAndFillItems.forEach(item => {
                      item.sourceContainers.forEach((sc: any) => {
                        if (sc.id) uniqueSourceContainers.add(sc.id);
                      });
                    });
                    
                    // Use the count of unique source containers that will have labels
                    const sourceCount = uniqueSourceContainers.size;
                    
                    if (sourceCount > 0) {
                      return (
                        <div className="flex justify-between items-center bg-yellow-50 rounded-lg px-4 py-3">
                          <span className="text-gray-700">Source Container Label{sourceCount > 1 ? 's' : ''} (Pump & Fill)</span>
                          <span className="font-semibold text-gray-900">
                            {sourceCount} label{sourceCount > 1 ? 's' : ''}
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
                        // Count source labels for pump & fill items
                        const pumpAndFillItems = sourceAssignments.filter(a => a.workflowType === 'pump_and_fill');
                        const uniqueSourceContainers = new Set<string>();
                        
                        pumpAndFillItems.forEach(item => {
                          item.sourceContainers.forEach((sc: any) => {
                            if (sc.id) uniqueSourceContainers.add(sc.id);
                          });
                        });
                        
                        const sourceCount = uniqueSourceContainers.size;
                        
                        // Calculate total based on what will actually print
                        return labelSummary.master + sourceCount + labelSummary.drums + 
                               labelSummary.totes + labelSummary.pallets;
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
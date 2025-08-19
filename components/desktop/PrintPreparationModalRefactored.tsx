'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/solid';
import SourceAssignmentManager, { type SourceAssignment } from './print-preparation/SourceAssignmentManager';
import GradeMismatchValidator from './print-preparation/GradeMismatchValidator';
import QRCodeSummary from './print-preparation/QRCodeSummary';
import { debugQR, DebugTimer } from '@/lib/utils/debug';

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

export default function PrintPreparationModalRefactored({ 
  order, 
  onClose, 
  onPrintComplete 
}: PrintPreparationModalProps) {
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [sourceAssignments, setSourceAssignments] = useState<SourceAssignment[]>([]);
  const [gradeMismatchWarning, setGradeMismatchWarning] = useState<{
    sourceGrade: string;
    destinationGrade: string;
    sourceContainer: string;
    productName: string;
  } | null>(null);

  const labelSummary = calculateLabelSummary(qrCodes, sourceAssignments);

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchQRCodes(),
        initializeSourceAssignments(),
        fetchExistingSourceAssignments()
      ]);
    };
    init();
  }, [order.orderId]);

  const fetchQRCodes = async () => {
    const timer = new DebugTimer('QR');
    setLoading(true);
    try {
      const response = await fetch(`/api/workspace/${order.orderId}/qr`);
      if (!response.ok) throw new Error('Failed to fetch QR codes');
      
      const data = await response.json();
      debugQR('QR codes fetched', data);
      setQrCodes(data.qrCodes || []);
    } catch (error) {
      debugQR('Error fetching QR codes', error);
    } finally {
      setLoading(false);
      timer.end('QR fetch');
    }
  };

  const fetchExistingSourceAssignments = async () => {
    try {
      const response = await fetch(`/api/workspace/${order.orderId}/assign-source`);
      const data = await response.json();
      
      if (data.success && data.sourceAssignments?.length > 0) {
        setSourceAssignments(prevAssignments => 
          prevAssignments.map(assignment => {
            const existing = data.sourceAssignments.find((sa: any) => 
              sa.lineItemId === assignment.lineItemId
            );
            return existing ? {
              ...assignment,
              workflowType: existing.workflowType || 'pump_and_fill',
              sourceContainers: existing.sourceContainers || []
            } : assignment;
          })
        );
      }
    } catch (error) {
      debugQR('Error fetching existing assignments', error);
    }
  };

  const initializeSourceAssignments = () => {
    if (!order.items) return;
    
    const assignments: SourceAssignment[] = order.items.map(item => ({
      lineItemId: item.lineItemId || item.id,
      productName: item.name || item.productName,
      quantity: item.quantity,
      workflowType: determineWorkflowType(item),
      sourceContainers: []
    }));
    
    setSourceAssignments(assignments);
  };

  const determineWorkflowType = (item: any): 'pump_and_fill' | 'direct_resell' => {
    const name = (item.name || item.productName || '').toLowerCase();
    const tags = item.tags || [];
    
    if (tags.includes('ready-to-ship') || tags.includes('direct-resell')) {
      return 'direct_resell';
    }
    
    if (name.includes('ready to ship') || name.includes('pre-packaged')) {
      return 'direct_resell';
    }
    
    return 'pump_and_fill';
  };

  const handlePrintAll = async () => {
    setPrinting(true);
    try {
      // Generate source QR codes for pump & fill items
      const sourceQRs = await generateSourceQRCodes();
      
      // Print all labels
      const allQRs = [...qrCodes, ...sourceQRs];
      await printLabels(allQRs);
      
      // Save assignments
      await saveSourceAssignments();
      
      onPrintComplete();
    } catch (error) {
      debugQR('Print error', error);
      alert('Failed to print labels. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  const generateSourceQRCodes = async () => {
    const pumpAndFillItems = sourceAssignments.filter(a => 
      a.workflowType === 'pump_and_fill' && a.sourceContainers.length > 0
    );
    
    const uniqueSourceIds = new Set<string>();
    pumpAndFillItems.forEach(item => {
      item.sourceContainers.forEach(sc => {
        if (sc.id) uniqueSourceIds.add(sc.id);
      });
    });
    
    if (uniqueSourceIds.size === 0) return [];
    
    try {
      const response = await fetch(`/api/workspace/${order.orderId}/qr/source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceContainerIds: Array.from(uniqueSourceIds),
          assignments: sourceAssignments
        })
      });
      
      const data = await response.json();
      return data.qrCodes || [];
    } catch (error) {
      debugQR('Error generating source QRs', error);
      return [];
    }
  };

  const printLabels = async (qrCodes: QRCode[]) => {
    const response = await fetch('/api/qr/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrCodes, orderId: order.orderId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to print labels');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labels-order-${order.orderNumber}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const saveSourceAssignments = async () => {
    try {
      await fetch(`/api/workspace/${order.orderId}/assign-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceAssignments })
      });
    } catch (error) {
      debugQR('Error saving assignments', error);
    }
  };

  const handleGradeMismatch = (mismatch: typeof gradeMismatchWarning) => {
    setGradeMismatchWarning(mismatch);
  };

  const allItemsReady = sourceAssignments
    .filter(a => a.workflowType === 'pump_and_fill')
    .every(a => a.sourceContainers.length > 0);

  const hasUnassignedItems = sourceAssignments.some(
    a => a.workflowType === 'pump_and_fill' && a.sourceContainers.length === 0
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            Print Preparation - Order #{order.orderNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {/* Source Assignment Manager */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Assign Source Containers
                </h3>
                <SourceAssignmentManager
                  assignments={sourceAssignments}
                  onAssignmentsChange={setSourceAssignments}
                  onGradeMismatch={handleGradeMismatch}
                />
              </div>

              {/* QR Code Summary */}
              <QRCodeSummary
                summary={labelSummary}
                hasUnassignedItems={hasUnassignedItems}
              />

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6">
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

      {/* Grade Mismatch Validator */}
      <GradeMismatchValidator
        warning={gradeMismatchWarning}
        onConfirm={() => setGradeMismatchWarning(null)}
        onCancel={() => setGradeMismatchWarning(null)}
      />
    </div>
  );
}

function calculateLabelSummary(
  qrCodes: QRCode[], 
  sourceAssignments: SourceAssignment[]
) {
  const summary = {
    master: 0,
    source: 0,
    drums: 0,
    totes: 0,
    pallets: 0
  };

  // Count existing QR codes
  qrCodes.forEach(qr => {
    const type = qr.qrType || qr.type || '';
    if (type === 'master') summary.master++;
    else if (type === 'source') summary.source++;
    else if (type === 'container') {
      const containerType = qr.metadata?.containerType || '';
      if (containerType.includes('tote')) summary.totes++;
      else if (containerType.includes('pallet')) summary.pallets++;
      else summary.drums++;
    }
  });

  // Count source containers for pump & fill items
  const pumpAndFillItems = sourceAssignments.filter(a => a.workflowType === 'pump_and_fill');
  const uniqueSourceContainers = new Set<string>();
  
  pumpAndFillItems.forEach(item => {
    item.sourceContainers.forEach(sc => {
      if (sc.id) uniqueSourceContainers.add(sc.id);
    });
  });
  
  summary.source = uniqueSourceContainers.size;

  return summary;
}
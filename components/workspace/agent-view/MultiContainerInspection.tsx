'use client';

import React from 'react';
import { FastQRScanner } from '@/components/qr/FastQRScanner';
import IssueModal from './IssueModal';
import { Button } from '../../ui/button';
import { useMultiContainerInspection } from '@/hooks/useMultiContainerInspection';
import { ContainerList } from '@/components/inspection/ContainerList';
import { ContainerInspectionForm } from '@/components/inspection/ContainerInspectionForm';
import { InspectionStats } from '@/components/inspection/InspectionStats';

interface MultiContainerInspectionProps {
  orderId: string;
  orderNumber: string;
  customerName?: string;
  item: {
    name: string;
    quantity: number;
    sku?: string;
  };
  workflowType: 'direct_resell' | 'pump_and_fill';
  containerType: 'tote' | 'drum' | 'pail' | 'bottle';
  qrScanned?: boolean;
  onComplete: (results: any) => void;
  onSwitchToSupervisor: () => void;
  onBackToEntry?: () => void;
}

export default function MultiContainerInspection({
  orderId,
  orderNumber,
  customerName,
  item,
  workflowType: _workflowType,
  containerType,
  qrScanned = false,
  onComplete,
  onSwitchToSupervisor,
  onBackToEntry,
}: MultiContainerInspectionProps) {
  const {
    containers,
    currentContainer,
    currentQuestion,
    showScanner,
    showIssueModal,
    currentIssue,
    scanSpeed,
    questions,
    progress,
    stats,
    setShowScanner,
    setShowIssueModal,
    handleQRScan,
    handleQuestionPass,
    handleQuestionFail,
    handleIssueReported,
    getContainerStatus,
  } = useMultiContainerInspection({
    quantity: item.quantity,
    containerType,
    onComplete,
  });

  if (containers.length === 0) {
    return <div>Loading...</div>;
  }

  // Check if QR was scanned before allowing inspection
  if (!qrScanned) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md text-center px-6">
          <div className="mb-6">
            <div className="mx-auto w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-16 h-16 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">QR Scan Required</h1>
          <p className="text-lg text-gray-600 mb-8">
            You must scan the workspace QR code before starting container inspection.
          </p>
          <div className="space-y-3">
            {onBackToEntry ? (
              <Button
                onClick={onBackToEntry}
                variant="go"
                size="xlarge"
                fullWidth
              >
                Go Back and Scan QR
              </Button>
            ) : (
              <p className="text-sm text-gray-500">
                Please return to the entry screen to scan the QR code.
              </p>
            )}
            <Button
              onClick={onSwitchToSupervisor}
              variant="neutral"
              size="large"
              fullWidth
            >
              Switch to Supervisor View
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Container Inspection
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Order #{orderNumber} • {customerName}
              </p>
            </div>
            <Button
              onClick={onSwitchToSupervisor}
              variant="neutral"
              size="base"
            >
              Supervisor View
            </Button>
          </div>
        </div>
      </div>

      {/* Product Info Bar */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase">Inspecting:</p>
              <p className="text-xl font-bold text-gray-900">{item.name}</p>
              {item.sku && <p className="text-sm text-gray-600">SKU: {item.sku}</p>}
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{item.quantity}</p>
              <p className="text-sm text-gray-600">{containerType}s</p>
            </div>
          </div>
        </div>
      </div>

      {/* Container Progress Grid */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <ContainerList
          containers={containers}
          progress={progress}
          scanSpeed={scanSpeed}
          getContainerStatus={getContainerStatus}
        />
      </div>

      {/* Current Action */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <ContainerInspectionForm
          currentContainer={containers[currentContainer]}
          containerNumber={containers[currentContainer]?.number || 0}
          containerType={containerType}
          currentQuestion={currentQuestion}
          questions={questions}
          showScanner={showScanner}
          onOpenScanner={() => setShowScanner(true)}
          onSkipScanning={() => handleQRScan(`MANUAL-${Date.now()}`)}
          onQuestionPass={handleQuestionPass}
          onQuestionFail={handleQuestionFail}
        />
      </div>

      {/* Quick Stats */}
      <div className="max-w-4xl mx-auto px-4 mt-6 mb-8">
        <InspectionStats
          scanned={stats.scanned}
          inspected={stats.inspected}
          remaining={stats.remaining}
        />
      </div>

      {/* Fast QR Scanner Modal */}
      {showScanner && (
        <FastQRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
          continuous={false}
          autoFocus={true}
        />
      )}

      {/* Issue Modal */}
      {showIssueModal && currentIssue && (
        <IssueModal
          isOpen={showIssueModal}
          onClose={() => setShowIssueModal(false)}
          orderId={orderId}
          item={{
            id: `container-${currentIssue.container}`,
            label: `Container ${currentIssue.container + 1}: ${currentIssue.question}`,
            description: `Issue with ${containerType} inspection`,
          }}
          workflowPhase="pre_mix"
          onIssueReported={handleIssueReported}
        />
      )}
    </div>
  );
}

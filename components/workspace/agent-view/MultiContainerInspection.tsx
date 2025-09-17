'use client';

import React from 'react';
import { FastQRScanner } from '@/components/qr/FastQRScanner';
import IssueModal from './IssueModal';
import { Button } from '@/components/ui/button';
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
  onComplete: (results: any) => void;
  onSwitchToSupervisor: () => void;
}

export default function MultiContainerInspection({
  orderId,
  orderNumber,
  customerName,
  item,
  workflowType,
  containerType,
  onComplete,
  onSwitchToSupervisor,
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

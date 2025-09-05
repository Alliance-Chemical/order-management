'use client';

import React, { useState, useEffect } from 'react';
import { FastQRScanner } from '@/components/qr/FastQRScanner';
import IssueModal from './IssueModal';
import WarehouseButton from '@/components/ui/WarehouseButton';
import StatusLight from '@/components/ui/StatusLight';
import ProgressBar from '@/components/ui/ProgressBar';

interface Container {
  id: string;
  number: number;
  scanned: boolean;
  inspected: boolean;
  issues: string[];
  qrData?: string;
}

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

const INSPECTION_QUESTIONS = {
  tote: [
    { id: 'clean', label: 'Is the container clean?', icon: '✨' },
    { id: 'sealed', label: 'Is the seal intact?', icon: '🔒' },
    { id: 'label', label: 'Is the label correct?', icon: '🏷️' },
    { id: 'damage', label: 'No visible damage?', icon: '✅' },
  ],
  drum: [
    { id: 'clean', label: 'Is the drum clean?', icon: '✨' },
    { id: 'sealed', label: 'Is the bung sealed?', icon: '🔒' },
    { id: 'label', label: 'Is the label correct?', icon: '🏷️' },
    { id: 'damage', label: 'No dents or damage?', icon: '✅' },
  ],
  pail: [
    { id: 'clean', label: 'Is the pail clean?', icon: '✨' },
    { id: 'lid', label: 'Is the lid secure?', icon: '🔒' },
    { id: 'label', label: 'Is the label correct?', icon: '🏷️' },
  ],
  bottle: [
    { id: 'clean', label: 'Is the bottle clean?', icon: '✨' },
    { id: 'cap', label: 'Is the cap secure?', icon: '🔒' },
    { id: 'label', label: 'Is the label correct?', icon: '🏷️' },
  ],
};

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
  const [containers, setContainers] = useState<Container[]>([]);
  const [currentContainer, setCurrentContainer] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [showScanner, setShowScanner] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [currentIssue, setCurrentIssue] = useState<{ container: number; question: string } | null>(null);
  const [scanSpeed, setScanSpeed] = useState<number>(0);
  const [lastScanTime, setLastScanTime] = useState<number>(0);

  const questions = INSPECTION_QUESTIONS[containerType] || INSPECTION_QUESTIONS.tote;

  // Initialize containers
  useEffect(() => {
    const containerList: Container[] = [];
    for (let i = 0; i < item.quantity; i++) {
      containerList.push({
        id: `container-${i}`,
        number: i + 1,
        scanned: false,
        inspected: false,
        issues: [],
      });
    }
    setContainers(containerList);
  }, [item.quantity]);

  const handleQRScan = (qrData: string) => {
    const scanTime = Date.now();
    const timeDiff = lastScanTime ? (scanTime - lastScanTime) / 1000 : 0;
    
    // Calculate scan speed
    if (lastScanTime) {
      setScanSpeed(Math.round(1 / timeDiff * 10) / 10); // Scans per second
    }
    setLastScanTime(scanTime);

    // Update container as scanned
    const updatedContainers = [...containers];
    updatedContainers[currentContainer].scanned = true;
    updatedContainers[currentContainer].qrData = qrData;
    setContainers(updatedContainers);

    // Close scanner and move to inspection questions
    setShowScanner(false);
    setCurrentQuestion(0);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]); // Double vibration for success
    }
  };

  const handleQuestionPass = () => {
    if (currentQuestion < questions.length - 1) {
      // Move to next question
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // All questions passed for this container
      const updatedContainers = [...containers];
      updatedContainers[currentContainer].inspected = true;
      setContainers(updatedContainers);

      if (currentContainer < containers.length - 1) {
        // Move to next container
        setCurrentContainer(currentContainer + 1);
        setCurrentQuestion(0);
        setShowScanner(true);
      } else {
        // All containers inspected
        completeInspection();
      }
    }
  };

  const handleQuestionFail = () => {
    setCurrentIssue({
      container: currentContainer,
      question: questions[currentQuestion].label,
    });
    setShowIssueModal(true);
  };

  const handleIssueReported = (reason: string) => {
    const updatedContainers = [...containers];
    updatedContainers[currentContainer].issues.push(
      `${questions[currentQuestion].label}: ${reason}`
    );
    setContainers(updatedContainers);
    setShowIssueModal(false);

    // Move to next question or container
    handleQuestionPass();
  };

  const completeInspection = () => {
    const results = {
      containers: containers.map(c => ({
        number: c.number,
        qrData: c.qrData,
        inspected: c.inspected,
        issues: c.issues,
      })),
      completedAt: new Date().toISOString(),
      averageScanSpeed: scanSpeed,
    };
    onComplete(results);
  };

  const getContainerStatus = (index: number) => {
    const container = containers[index];
    if (!container) return 'pending';
    if (container.inspected) return 'completed';
    if (container.scanned) return 'scanning';
    if (index === currentContainer) return 'current';
    return 'pending';
  };

  const progress = containers.length > 0 
    ? (containers.filter(c => c.inspected).length / containers.length) * 100 
    : 0;

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
            <WarehouseButton
              onClick={onSwitchToSupervisor}
              variant="neutral"
              size="base"
            >
              Supervisor View
            </WarehouseButton>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Container Progress</h2>
            <ProgressBar
              value={progress}
              label="Inspection Progress"
              showPercentage={true}
              variant={progress === 100 ? "success" : "default"}
              animated={progress < 100}
            />
          </div>
          
          {/* Container Grid */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {containers.map((container, idx) => {
              const status = getContainerStatus(idx);
              return (
                <div
                  key={container.id}
                  className={`
                    aspect-square rounded-lg flex items-center justify-center font-bold text-sm
                    transition-all duration-300 transform
                    ${status === 'completed' ? 'bg-green-500 text-white scale-95' : ''}
                    ${status === 'current' ? 'bg-blue-500 text-white animate-pulse scale-110 ring-4 ring-blue-200' : ''}
                    ${status === 'scanning' ? 'bg-yellow-500 text-white' : ''}
                    ${status === 'pending' ? 'bg-gray-200 text-gray-500' : ''}
                  `}
                >
                  {status === 'completed' ? '✓' : container.number}
                </div>
              );
            })}
          </div>

          {/* Speed indicator */}
          {scanSpeed > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Scan Speed:</span>
                <span className="text-sm font-bold text-green-600">
                  {scanSpeed} containers/sec
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Action */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {!containers[currentContainer]?.scanned ? (
          // Scan QR Stage
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-4">
                <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 4v1m6 11l.01-.01M12 12h.01M3 12h.01M12 19v1m8-16.364l-.707.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Scan {containerType.charAt(0).toUpperCase() + containerType.slice(1)} #{containers[currentContainer]?.number}
              </h3>
              <p className="text-gray-600 mb-6">
                Position the QR code in the camera view
              </p>

              <WarehouseButton
                onClick={() => setShowScanner(true)}
                variant="info"
                size="xlarge"
                fullWidth
                haptic="light"
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                className="max-w-md mx-auto"
              >
                OPEN SCANNER
              </WarehouseButton>

              <WarehouseButton
                onClick={() => handleQRScan(`MANUAL-${Date.now()}`)}
                variant="neutral"
                size="base"
                className="mt-4"
              >
                Skip scanning (testing only)
              </WarehouseButton>
            </div>
          </div>
        ) : (
          // Inspection Questions Stage
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4 text-3xl">
                {questions[currentQuestion].icon}
              </div>
              
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {containerType.charAt(0).toUpperCase() + containerType.slice(1)} #{containers[currentContainer].number}
              </h3>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {questions[currentQuestion].label}
              </h2>

              <div className="flex items-center justify-center gap-2 mb-6">
                {questions.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx < currentQuestion ? 'w-8 bg-green-500' :
                      idx === currentQuestion ? 'w-12 bg-blue-500' :
                      'w-8 bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <WarehouseButton
                  onClick={handleQuestionPass}
                  variant="go"
                  size="xlarge"
                  haptic="success"
                  icon={
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  }
                >
                  YES
                </WarehouseButton>
                
                <WarehouseButton
                  onClick={handleQuestionFail}
                  variant="stop"
                  size="xlarge"
                  haptic="error"
                  icon={
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  }
                >
                  NO
                </WarehouseButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="max-w-4xl mx-auto px-4 mt-6 mb-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {containers.filter(c => c.scanned).length}
            </p>
            <p className="text-sm text-gray-600">Scanned</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {containers.filter(c => c.inspected).length}
            </p>
            <p className="text-sm text-gray-600">Inspected</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {containers.length - containers.filter(c => c.inspected).length}
            </p>
            <p className="text-sm text-gray-600">Remaining</p>
          </div>
        </div>
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
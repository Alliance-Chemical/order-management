'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import type { Container, InspectionQuestion } from '@/types/components';

interface ContainerInspectionFormProps {
  currentContainer: Container | undefined;
  containerNumber: number;
  containerType: string;
  currentQuestion: number;
  questions: InspectionQuestion[];
  showScanner: boolean;
  onOpenScanner: () => void;
  onSkipScanning: () => void;
  onQuestionPass: () => void;
  onQuestionFail: () => void;
}

export const ContainerInspectionForm = React.memo(function ContainerInspectionForm({
  currentContainer,
  containerNumber,
  containerType,
  currentQuestion,
  questions,
  showScanner: _showScanner,
  onOpenScanner,
  onSkipScanning,
  onQuestionPass,
  onQuestionFail,
}: ContainerInspectionFormProps) {
  const isScanned = currentContainer?.scanned || false;
  const currentQ = questions[currentQuestion];

  if (!isScanned) {
    // Scan QR Stage
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-4">
            <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 4v1m6 11l.01-.01M12 12h.01M3 12h.01M12 19v1m8-16.364l-.707.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" />
            </svg>
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Scan {containerType.charAt(0).toUpperCase() + containerType.slice(1)} #{containerNumber}
          </h3>
          <p className="text-gray-600 mb-6">
            Position the QR code in the camera view
          </p>

          <Button
            onClick={onOpenScanner}
            variant="info"
            size="xlarge"
            className="max-w-md mx-auto w-full"
            aria-label={`Open QR scanner for ${containerType} ${containerNumber}`}
          >
            <svg className="w-8 h-8 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            OPEN SCANNER
          </Button>

          <Button
            onClick={onSkipScanning}
            variant="neutral"
            size="base"
            className="mt-4"
            aria-label="Skip QR code scanning (testing mode only)"
          >
            Skip scanning (testing only)
          </Button>
        </div>
      </div>
    );
  }

  // Inspection Questions Stage
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4 text-3xl">
          {currentQ.icon}
        </div>
        
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          {containerType.charAt(0).toUpperCase() + containerType.slice(1)} #{containerNumber}
        </h3>
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          {currentQ.label}
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

        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto" role="group" aria-label="Inspection question response">
          <Button
            onClick={onQuestionPass}
            variant="go"
            size="xlarge"
            aria-label={`Pass inspection: ${currentQ.label}`}
          >
            <svg className="w-8 h-8 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            YES
          </Button>

          <Button
            onClick={onQuestionFail}
            variant="stop"
            size="xlarge"
            aria-label={`Fail inspection: ${currentQ.label}`}
          >
            <svg className="w-8 h-8 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
            NO
          </Button>
        </div>
      </div>
    </div>
  );
});

'use client';

import React, { useEffect } from 'react';
import { usePreShipInspection } from '@/hooks/usePreShipInspection';
import { PreShipProgress } from '@/components/inspection/PreShipProgress';
import { PreShipInspectionItem } from '@/components/inspection/PreShipInspectionItem';
import { PreShipPhotoCapture } from '@/components/inspection/PreShipPhotoCapture';
import { PreShipCompletionView } from '@/components/inspection/PreShipCompletionView';
import { PreShipActionButtons } from '@/components/inspection/PreShipActionButtons';

interface PreShipInspectionWorkerProps {
  orderId: string;
  onCompleteAction: () => void;
}

export default function PreShipInspectionWorkerView({ orderId, onCompleteAction }: PreShipInspectionWorkerProps) {
  const {
    currentStep,
    capturedPhotos,
    showCamera,
    isProcessing,
    isFinishing,
    noteError,
    videoRef,
    canvasRef,
    fileInputRef,
    currentItem,
    isPhotoStep,
    isComplete,
    hasFailures,
    progress,
    inspectionItems,
    handlePass,
    handleFail,
    startCamera,
    stopCamera,
    capturePhoto,
    handleFileUpload,
    deletePhoto,
    handleComplete,
    skipToCompletion,
  } = usePreShipInspection({ orderId, onComplete: onCompleteAction });

  // Auto-start camera when reaching photo step
  useEffect(() => {
    if (isPhotoStep && showCamera) {
      startCamera();
    }
    // Cleanup camera on unmount or when leaving photo step
    return () => {
      stopCamera();
    };
  }, [isPhotoStep, showCamera, startCamera, stopCamera]);

  if (isComplete) {
    return (
      <PreShipCompletionView
        hasFailures={hasFailures}
        orderId={orderId}
        capturedPhotos={capturedPhotos}
        isFinishing={isFinishing}
        onComplete={handleComplete}
      />
    );
  }

  if (isPhotoStep) {
    return (
      <PreShipPhotoCapture
        videoRef={videoRef}
        canvasRef={canvasRef}
        fileInputRef={fileInputRef}
        showCamera={showCamera}
        isProcessing={isProcessing}
        capturedPhotos={capturedPhotos}
        onCapture={capturePhoto}
        onFileUpload={handleFileUpload}
        onDeletePhoto={deletePhoto}
        onContinue={skipToCompletion}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <PreShipProgress
        progress={progress}
        currentStep={currentStep}
        items={inspectionItems}
      />

      {currentItem && (
        <PreShipInspectionItem
          icon={currentItem.icon}
          label={currentItem.label}
          orderId={orderId}
        />
      )}

      <PreShipActionButtons
        onPass={handlePass}
        onFail={handleFail}
        noteError={noteError}
      />
    </div>
  );
}

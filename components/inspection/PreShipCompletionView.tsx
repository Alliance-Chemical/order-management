'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@heroicons/react/24/solid';

interface CapturedPhoto {
  lotNumbers: string[];
}

interface PreShipCompletionViewProps {
  hasFailures: boolean;
  orderId: string;
  capturedPhotos: CapturedPhoto[];
  isFinishing: boolean;
  onComplete: () => void;
}

export function PreShipCompletionView({
  hasFailures,
  orderId,
  capturedPhotos,
  isFinishing,
  onComplete,
}: PreShipCompletionViewProps) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      <div className="text-center">
        <div className={`text-8xl mb-4 ${hasFailures ? 'text-yellow-500' : 'text-green-500'}`}>
          {hasFailures ? '⚠️' : '✅'}
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">
          {hasFailures ? 'INSPECTION COMPLETE' : 'ALL GOOD!'}
        </h1>
        {hasFailures && (
          <p className="text-xl text-yellow-400 mb-4">Issues reported - supervisor notified</p>
        )}
        <p className="text-2xl text-gray-300 mb-8">Order #{orderId}</p>
        
        {capturedPhotos.length > 0 && (
          <div className="mb-8">
            <p className="text-lg text-gray-400 mb-2">Lot Numbers Captured:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {capturedPhotos.flatMap(p => p.lotNumbers).map((lot, i) => (
                <span key={i} className="px-3 py-1 bg-gray-800 text-white rounded font-mono">
                  {lot}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <Button
          onClick={onComplete}
          disabled={isFinishing}
          variant="go"
          size="xlarge"
          className="min-w-[200px]"
        >
          <CheckIcon className="w-8 h-8 mr-2" />
          {isFinishing ? 'UPLOADING…' : 'FINISH'}
        </Button>
      </div>
    </div>
  );
}
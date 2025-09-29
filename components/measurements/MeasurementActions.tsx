'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCodeIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { SaveState } from '@/hooks/useFinalMeasurements';

interface MeasurementActionsProps {
  containerCode?: string | null;
  autoSaveState: SaveState;
  lastSaved: Date | null;
  validationError?: string;
  saveError?: string;
  onOpenScanner: () => void;
  onReset: () => void;
  onRemove?: () => void;
  disableRemove?: boolean;
}

export function MeasurementActions({
  containerCode,
  autoSaveState,
  lastSaved,
  validationError,
  saveError,
  onOpenScanner,
  onReset,
  onRemove,
  disableRemove,
}: MeasurementActionsProps) {
  const statusMessage = (() => {
    if (autoSaveState === 'saving') {
      return 'Auto-saving…';
    }
    if (autoSaveState === 'error') {
      return saveError || 'Unable to save changes';
    }
    if (lastSaved) {
      return `Saved ${lastSaved.toLocaleTimeString()}`;
    }
    return 'Waiting for updates';
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center">
          <QrCodeIcon className="h-5 w-5 text-gray-500 mr-2" />
          <span className="text-sm text-gray-600">
            Container: {containerCode || 'Not scanned'}
          </span>
        </div>
        <Button
          onClick={onOpenScanner}
          variant="outline"
          size="sm"
        >
          {containerCode ? 'Re-scan' : 'Scan QR'}
        </Button>
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {autoSaveState !== 'error' && lastSaved && !validationError && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircleIcon className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Measurements saved successfully at {lastSaved.toLocaleTimeString()}
          </AlertDescription>
        </Alert>
      )}

      {autoSaveState === 'error' && saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          {statusMessage}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onReset}
            variant="outline"
            size="sm"
          >
            Reset
          </Button>
          {onRemove && (
            <Button
              onClick={onRemove}
              variant="ghost"
              size="sm"
              disabled={disableRemove}
            >
              <XMarkIcon className="h-4 w-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

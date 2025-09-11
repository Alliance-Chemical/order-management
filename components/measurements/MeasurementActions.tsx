'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCodeIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface MeasurementActionsProps {
  scannedContainer: string | null;
  saving: boolean;
  lastSaved: Date | null;
  validationError: string;
  onOpenScanner: () => void;
  onSave: () => void;
  onReset: () => void;
}

export function MeasurementActions({
  scannedContainer,
  saving,
  lastSaved,
  validationError,
  onOpenScanner,
  onSave,
  onReset,
}: MeasurementActionsProps) {
  return (
    <div className="space-y-4">
      {/* Scanner Status */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center">
          <QrCodeIcon className="h-5 w-5 text-gray-500 mr-2" />
          <span className="text-sm text-gray-600">
            Container: {scannedContainer || 'Not scanned'}
          </span>
        </div>
        <Button
          onClick={onOpenScanner}
          variant="outline"
          size="sm"
        >
          {scannedContainer ? 'Re-scan' : 'Scan QR'}
        </Button>
      </div>

      {/* Error Alert */}
      {validationError && (
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {lastSaved && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircleIcon className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Measurements saved successfully at {lastSaved.toLocaleTimeString()}
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={onReset}
          variant="outline"
          disabled={saving}
        >
          Reset
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          className="flex-1"
        >
          {saving ? 'Saving...' : 'Save Measurements'}
        </Button>
      </div>
    </div>
  );
}
'use client';

import React, { useEffect, useMemo } from 'react';
import { useQRScanner, type ValidatedQRData } from '@/hooks/useQRScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface UnifiedQRScannerProps {
  onScan: (data: string) => void;
  onValidatedScan?: (data: ValidatedQRData) => void;
  onClose: () => void;
  continuous?: boolean;
  autoFocus?: boolean;
  validateQR?: boolean;
  allowManualEntry?: boolean;
  supervisorMode?: boolean;
  title?: string;
}

export function UnifiedQRScanner({
  onScan,
  onValidatedScan,
  onClose,
  continuous = false,
  autoFocus = true,
  validateQR = false,
  allowManualEntry = false,
  supervisorMode = false,
  title = 'Scan QR Code',
}: UnifiedQRScannerProps) {
  const {
    isScanning,
    scanCount,
    error,
    isValidating,
    validationError,
    showManualEntry,
    manualCode,
    scanSpeed,
    lastScannedCode,
    startScanner,
    stopScanner,
    handleManualEntry,
    setManualCode,
    setShowManualEntry,
  } = useQRScanner({
    onScan,
    onValidatedScan,
    onClose,
    continuous,
    autoFocus,
    validateQR,
    allowManualEntry,
  });

  const friendlyError = useMemo(() => {
    const rawMessage = validationError || error;
    if (!rawMessage) {
      return '';
    }

    const lower = rawMessage.toLowerCase();
    if (lower.includes('not found')) {
      return 'QR code not found in the system. Double-check the label or use manual entry below to continue.';
    }

    if (lower.includes('failed to start camera')) {
      return `${rawMessage}. Try allowing camera access or use manual entry.`;
    }

    return rawMessage;
  }, [error, validationError]);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 z-10 p-4 ${
        supervisorMode ? 'bg-orange-600' : 'bg-blue-600'
      }`}>
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-xl font-bold">{title}</h2>
            {scanCount > 0 && (
              <p className="text-sm opacity-90">
                Scanned: {scanCount} | Speed: {scanSpeed}/sec
              </p>
            )}
          </div>
          <Button
            onClick={stopScanner}
            variant="ghost"
            size="base"
            className="text-white hover:bg-white/20"
          >
            <XMarkIcon className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Scanner Area */}
      <div id="qr-reader" className="w-full h-full" />

      {/* Scan Guide Overlay */}
      {isScanning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            <div className="w-64 h-64 border-4 border-white rounded-lg opacity-50" />
            <div className="absolute -top-8 left-0 right-0 text-center">
              <p className="text-white text-sm font-medium">
                Position QR code within frame
              </p>
            </div>
            {continuous && lastScannedCode && (
              <div className="absolute -bottom-12 left-0 right-0 text-center">
                <p className="text-green-400 text-sm">
                  Last: {lastScannedCode.substring(0, 20)}...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Indicator */}
      {isValidating && (
        <div className="absolute bottom-32 left-4 right-4">
          <div className="bg-blue-500 text-white rounded-lg p-3 text-center">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              <span>Validating QR code...</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {friendlyError && (
        <div className="absolute bottom-32 left-4 right-4">
          <div className="bg-red-500 text-white rounded-lg p-3">
            <p className="font-bold">Error</p>
            <p className="text-sm">{friendlyError}</p>
            {allowManualEntry && (
              <Button
                onClick={() => setShowManualEntry(true)}
                variant="secondary"
                size="sm"
                className="mt-2"
              >
                Enter Manually
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex gap-4">
          {allowManualEntry && (
            <Button
              onClick={() => setShowManualEntry(true)}
              variant="secondary"
              size="xlarge"
              className="flex-1"
            >
              Enter Code
            </Button>
          )}
          <Button
            onClick={stopScanner}
            variant={supervisorMode ? "caution" : "stop"}
            size="xlarge"
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter QR Code Manually</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Enter code or short code"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleManualEntry();
                }
              }}
              autoFocus
              className="text-2xl text-center font-mono"
            />
            {validationError && (
              <p className="text-sm text-red-500">{validationError}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowManualEntry(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualEntry}
              disabled={!manualCode.trim() || isValidating}
              className="flex-1"
            >
              {isValidating ? 'Validating...' : 'Submit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export variants for backward compatibility
export function QRScanner(props: Omit<UnifiedQRScannerProps, 'validateQR'>) {
  return <UnifiedQRScanner {...props} validateQR={false} />;
}

export function ValidatedQRScanner(props: Omit<UnifiedQRScannerProps, 'validateQR'>) {
  return <UnifiedQRScanner {...props} validateQR={true} />;
}

export function FastQRScanner(props: Pick<UnifiedQRScannerProps, 'onScan' | 'onClose' | 'continuous' | 'autoFocus'>) {
  return (
    <UnifiedQRScanner 
      {...props} 
      validateQR={false}
      allowManualEntry={false}
      title="Fast QR Scanner"
    />
  );
}

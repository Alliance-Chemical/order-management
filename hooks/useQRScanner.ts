import { useState, useRef, useCallback, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import { validateQR as validateQRAction } from '@/app/actions/qr';

export interface ValidatedQRData {
  id: string;
  shortCode: string;
  type: string;
  workspace: {
    id: string;
    orderId: string;
    orderNumber: string;
    status: string;
  };
  [key: string]: unknown;
}

interface UseQRScannerProps {
  onScan: (data: string) => void;
  onValidatedScan?: (data: ValidatedQRData) => void;
  onClose: () => void;
  continuous?: boolean;
  autoFocus?: boolean;
  validateQR?: boolean;
  allowManualEntry?: boolean;
}

export function useQRScanner({
  onScan,
  onValidatedScan,
  onClose,
  continuous = false,
  autoFocus = true,
  validateQR: shouldValidateQR = false,
  allowManualEntry = false,
}: UseQRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const hasActiveSessionRef = useRef(false);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [scanCount, setScanCount] = useState(0);
  const [error, setError] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanSpeed, setScanSpeed] = useState<number>(0);
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const validateQRCode = useCallback(async (code: string): Promise<
    { valid: true; data: ValidatedQRData } | { valid: false; error: string }
  > => {
    setIsValidating(true);
    setValidationError('');

    try {
      const result = await validateQRAction(code);

      if (!result.success || !result.valid || !result.qr) {
        throw new Error(result.error || 'Invalid QR code');
      }

      return { valid: true, data: result.qr as ValidatedQRData };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      setValidationError(message);
      warehouseFeedback.error();
      return { valid: false, error: message };
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleScan = useCallback(async (decodedText: string) => {
    // Prevent duplicate scans
    if (decodedText === lastScannedCode && !continuous) {
      return;
    }

    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Calculate scan speed
    const now = Date.now();
    if (lastScanTime) {
      const timeDiff = (now - lastScanTime) / 1000;
      setScanSpeed(Math.round(1 / timeDiff * 10) / 10);
    }
    setLastScanTime(now);

    // Haptic feedback
    try {
      warehouseFeedback.scan();
    } catch {
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }

    setLastScannedCode(decodedText);
    setScanCount(prev => prev + 1);

    // Validate if needed
    if (shouldValidateQR) {
      const validation = await validateQRCode(decodedText);
      if (validation.valid) {
        warehouseFeedback.success();
        if (onValidatedScan) {
          onValidatedScan(validation.data);
        } else {
          onScan(decodedText);
        }
        
        if (!continuous) {
          stopScanner();
        }
      }
    } else {
      onScan(decodedText);
      
      if (!continuous) {
        stopScanner();
      }
    }

    // In continuous mode, add a brief delay before accepting the next scan
    if (continuous) {
      scanTimeoutRef.current = setTimeout(() => {
        setLastScannedCode('');
      }, 500);
    }
  }, [continuous, lastScannedCode, lastScanTime, shouldValidateQR, validateQRCode, onScan, onValidatedScan]);

  const startScanner = useCallback(async () => {
    try {
      hasActiveSessionRef.current = false;
      setError('');
      const html5QrCode = new Html5Qrcode('qr-reader', {
        formatsToSupport: [0, 1, 2, 3, 4], // All major QR/barcode formats
        verbose: false,
      });
      scannerRef.current = html5QrCode;
      
      // Get cameras
      const cameras = await Html5Qrcode.getCameras();
      
      if (cameras && cameras.length > 0) {
        // Prefer back camera on mobile
        const backCamera = cameras.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('rear') ||
          camera.label.toLowerCase().includes('environment')
        );
        
        const cameraId = backCamera ? backCamera.id : cameras[0].id;
        
        // Optimized config for fast scanning
        const config = {
          fps: 30,
          qrbox: { 
            width: Math.min(300, window.innerWidth - 50), 
            height: Math.min(300, window.innerWidth - 50) 
          },
          aspectRatio: 1.0,
          disableFlip: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          },
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1920, min: 720 },
            ...(autoFocus && { focusMode: 'continuous' as unknown as ConstrainDOMString })
          }
        };
        
        hasActiveSessionRef.current = true;

        await html5QrCode.start(
          cameraId,
          config,
          handleScan,
          (errorMessage) => {
            // Ignore scan errors (when no QR code is visible)
          }
        );

        setIsScanning(true);
      } else {
        throw new Error('No cameras found');
      }
    } catch (err) {
      console.error('Failed to start scanner:', err);
      setError(err instanceof Error ? err.message : 'Failed to start camera');

      // Ensure scanner state is cleared so stop() is not called on a non-running instance
      hasActiveSessionRef.current = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        try {
          await scanner.stop();
        } catch {
          /* ignore cleanup errors */
        }
      }
      setIsScanning(false);

      // Show manual entry if camera fails
      if (allowManualEntry) {
        setShowManualEntry(true);
      }
    }
  }, [autoFocus, handleScan, allowManualEntry]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    const hasActiveSession = hasActiveSessionRef.current;
    hasActiveSessionRef.current = false;
    scannerRef.current = null;

    if (scanner && hasActiveSession) {
      try {
        await scanner.stop();
      } catch (err) {
        // html5-qrcode throws if stop is called while not running; swallow to avoid crashing the UI
        console.warn('Scanner stop skipped:', err);
      }
    }
    setIsScanning(false);

    onClose();
  }, [onClose]);

  const handleManualEntry = useCallback(async () => {
    if (!manualCode.trim()) return;

    if (shouldValidateQR) {
      const validation = await validateQRCode(manualCode);
      if (validation.valid) {
        warehouseFeedback.success();
        if (onValidatedScan) {
          onValidatedScan(validation.data);
        } else {
          onScan(manualCode);
        }
        onClose();
      }
    } else {
      onScan(manualCode);
      onClose();
    }
  }, [manualCode, shouldValidateQR, validateQRCode, onScan, onValidatedScan, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        const hasActiveSession = hasActiveSessionRef.current;
        hasActiveSessionRef.current = false;
        scannerRef.current = null;
        if (hasActiveSession) {
          scanner.stop().catch(() => undefined);
        }
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    isScanning,
    scanCount,
    error,
    isValidating,
    validationError,
    showManualEntry,
    manualCode,
    scanSpeed,
    lastScannedCode,
    
    // Actions
    startScanner,
    stopScanner,
    handleManualEntry,
    setManualCode,
    setShowManualEntry,
  };
}

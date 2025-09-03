'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import { QRValidationService, QRType, QRValidationResult } from '@/lib/services/qr/validation';

interface ValidatedQRScannerProps {
  expectedType?: QRType;
  orderId?: string | number;
  containerNumber?: number;
  onValidScan: (data: any, shortCode?: string) => void;
  onClose: () => void;
  allowManualEntry?: boolean;
  allowSkip?: boolean;
  supervisorMode?: boolean;
}

export function ValidatedQRScanner({
  expectedType,
  orderId,
  containerNumber,
  onValidScan,
  onClose,
  allowManualEntry = true,
  allowSkip = false,
  supervisorMode = false
}: ValidatedQRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const validationService = useRef(new QRValidationService());

  useEffect(() => {
    let mounted = true;
    
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;
        
        const cameras = await Html5Qrcode.getCameras();
        
        if (cameras && cameras.length > 0) {
          // Prefer back camera
          const backCamera = cameras.find(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('rear') ||
            camera.label.toLowerCase().includes('environment')
          );
          
          const cameraId = backCamera ? backCamera.id : cameras[0].id;
          
          const config = {
            fps: 10,
            qrbox: { 
              width: Math.min(250, window.innerWidth - 100), 
              height: Math.min(250, window.innerWidth - 100) 
            },
            aspectRatio: window.innerHeight / window.innerWidth,
            videoConstraints: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          };
          
          await html5QrCode.start(
            cameraId,
            config,
            async (decodedText) => {
              if (mounted && !isValidating) {
                await handleCodeValidation(decodedText);
              }
            },
            undefined
          );
          
          if (mounted) {
            setIsScanning(true);
            setError('');
          }
        } else {
          setError('No cameras found');
          setShowManualEntry(true);
        }
      } catch (err) {
        console.error('Scanner error:', err);
        if (mounted) {
          setError('Camera access denied. Please allow camera access or enter code manually.');
          setShowManualEntry(true);
        }
      }
    };
    
    const timer = setTimeout(startScanner, 100);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleCodeValidation = async (code: string) => {
    setIsValidating(true);
    setError('');
    setSuggestion('');

    try {
      const result = await validationService.current.validate(code, {
        expectedType,
        orderId,
        containerNumber,
        allowManualEntry
      });

      if (result.valid) {
        // Haptics + tone for a successful scan
        try { warehouseFeedback.scan(); } catch {}
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
        
        // Show success animation
        setShowSuccess(true);
        
        // Stop scanner
        if (scannerRef.current && scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        
        // Delay before calling onValidScan to show animation
        setTimeout(() => {
          onValidScan(result.data, result.shortCode);
        }, 800);
      } else {
        setError(result.error);
        setSuggestion(result.suggestion || '');
        
        // Vibrate pattern for error
        if (navigator.vibrate) {
          navigator.vibrate([50, 50, 50]);
        }
      }
    } catch (error) {
      setError('Failed to validate code. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleManualSubmit = async () => {
    try { warehouseFeedback.buttonPress(); } catch {}
    if (manualCode.trim()) {
      await handleCodeValidation(manualCode.trim());
    }
  };

  const handleSkip = () => {
    if (allowSkip || supervisorMode) {
      // Log skip action
      console.log('Step skipped', { expectedType, orderId });
      onValidScan(null);
    }
  };

  const typeLabels: Record<QRType, string> = {
    source: 'Source Container',
    destination: 'Destination Container',
    order_master: 'Master Label',
    unknown: 'Any'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      {/* Success Animation Overlay */}
      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center z-60 pointer-events-none">
          <div className="bg-green-500 rounded-full p-8 animate-ping">
            <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="absolute bg-green-500 rounded-full p-8">
            <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">
              Scan {expectedType ? typeLabels[expectedType] : 'QR Code'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          {/* Visual Indicator for Expected QR Type */}
          {expectedType && (
            <div className={`mb-4 p-4 rounded-lg border-2 ${
              expectedType === 'source' ? 'bg-blue-50 border-blue-400' :
              expectedType === 'destination' ? 'bg-green-50 border-green-400' :
              'bg-purple-50 border-purple-400'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  expectedType === 'source' ? 'bg-blue-100' :
                  expectedType === 'destination' ? 'bg-green-100' :
                  'bg-purple-100'
                }`}>
                  {expectedType === 'source' ? (
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  ) : expectedType === 'destination' ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className={`font-semibold ${
                    expectedType === 'source' ? 'text-blue-900' :
                    expectedType === 'destination' ? 'text-green-900' :
                    'text-purple-900'
                  }`}>
                    Looking for: {typeLabels[expectedType]}
                  </div>
                  <div className={`text-sm ${
                    expectedType === 'source' ? 'text-blue-600' :
                    expectedType === 'destination' ? 'text-green-600' :
                    'text-purple-600'
                  }`}>
                    {expectedType === 'source' ? 'Scan the QR code on the bulk source container' :
                     expectedType === 'destination' ? 'Scan the QR code on the destination container' :
                     'Scan the master label QR code'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scanner View */}
          {!showManualEntry && (
            <div className="mb-4">
              <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
              {isScanning && (
                <p className="text-center text-gray-600 mt-2">
                  Position QR code within the frame
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-semibold">{error}</p>
              {suggestion && (
                <p className="text-red-600 mt-1 text-sm">{suggestion}</p>
              )}
            </div>
          )}

          {/* Manual Entry */}
          {(allowManualEntry || showManualEntry) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or enter code manually:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="e.g., 8XOEZD"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  maxLength={8}
                  disabled={isValidating}
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualCode.trim() || isValidating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isValidating ? 'Checking...' : 'Submit'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter the 6-8 character code shown below the QR code
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!showManualEntry && (
              <button
                onClick={() => setShowManualEntry(true)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Enter Manually
              </button>
            )}
            
            {(allowSkip || supervisorMode) && (
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                {supervisorMode ? 'Supervisor Override' : 'Skip Step'}
              </button>
            )}
          </div>

          {/* Help Text */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              {expectedType === 'source' && 
                "Scan the QR code on the bulk source container you're pumping from"}
              {expectedType === 'destination' && 
                "Scan the QR code on the destination container for this order"}
              {expectedType === 'order_master' && 
                "Scan the master label QR code for this order"}
              {!expectedType && 
                "Scan any QR code related to this order"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

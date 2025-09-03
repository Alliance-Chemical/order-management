'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface FastQRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  continuous?: boolean; // Keep scanning after first code
  autoFocus?: boolean; // Auto-focus on QR codes
}

export function FastQRScanner({ 
  onScan, 
  onClose, 
  continuous = false,
  autoFocus = true 
}: FastQRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [scanCount, setScanCount] = useState(0);
  const [error, setError] = useState('');
  const scanTimeoutRef = useRef<NodeJS.Timeout>();

  const handleScan = useCallback((decodedText: string) => {
    // Prevent duplicate scans
    if (decodedText === lastScannedCode && !continuous) {
      return;
    }

    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50); // Short vibration for speed
    }

    setLastScannedCode(decodedText);
    setScanCount(prev => prev + 1);
    onScan(decodedText);

    if (!continuous && scannerRef.current) {
      // Stop scanner after successful scan in single mode
      scannerRef.current.stop().then(() => {
        onClose();
      }).catch(console.error);
    } else {
      // In continuous mode, add a brief delay before accepting the next scan
      scanTimeoutRef.current = setTimeout(() => {
        setLastScannedCode('');
      }, 500);
    }
  }, [continuous, lastScannedCode, onScan, onClose]);

  useEffect(() => {
    let mounted = true;
    
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('fast-qr-reader', {
          formatsToSupport: [0, 1, 2, 3, 4], // All major QR/barcode formats
          verbose: false, // Reduce console logging
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
            fps: 30, // Higher FPS for faster scanning
            qrbox: { 
              width: Math.min(300, window.innerWidth - 50), 
              height: Math.min(300, window.innerWidth - 50) 
            },
            aspectRatio: 1.0, // Square aspect ratio for QR codes
            disableFlip: true, // Don't flip the image
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true // Use native API if available
            },
            videoConstraints: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1920, min: 720 },
              ...(autoFocus && { 
                focusMode: { ideal: "continuous" },
                advanced: [{ 
                  focusMode: "continuous",
                  zoom: 1.5 // Slight zoom for better QR detection
                }]
              })
            }
          };
          
          await html5QrCode.start(
            cameraId,
            config,
            handleScan,
            (errorMessage) => {
              // Ignore scan errors silently for smoother UX
            }
          );
          
          if (mounted) {
            setIsScanning(true);
            setError('');
          }
        } else {
          setError('No cameras found');
        }
      } catch (err: any) {
        console.error('Scanner error:', err);
        if (mounted) {
          // Handle different types of permission errors
          if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
            setError('Camera access denied. Please allow camera access in your browser settings.');
          } else if (err?.name === 'NotReadableError') {
            setError('Camera is already in use by another application.');
          } else if (err?.name === 'NotFoundError') {
            setError('No camera found on this device.');
          } else if (err?.name === 'AbortError' || err?.message?.includes('Permission dismissed')) {
            // User dismissed the permission dialog without making a choice
            setError('Camera permission was dismissed. Please reload and allow camera access.');
          } else {
            setError('Unable to access camera. Please check permissions.');
          }
        }
      }
    };
    
    // Start scanner immediately
    startScanner();
    
    return () => {
      mounted = false;
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [handleScan]);

  // Inject optimized CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      #fast-qr-reader {
        position: relative;
        padding: 0;
        border: none;
        width: 100%;
        height: 100%;
      }
      #fast-qr-reader video {
        border-radius: 16px;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover;
      }
      #fast-qr-reader__scan_region {
        background: transparent !important;
      }
      #fast-qr-reader__dashboard_section_swaplink {
        display: none !important;
      }
      #fast-qr-reader__dashboard_section_csr {
        display: none !important;
      }
      /* Highlight scanning area */
      #fast-qr-reader__scan_region {
        position: relative;
      }
      #fast-qr-reader__scan_region::before {
        content: '';
        position: absolute;
        inset: -2px;
        border: 3px solid #10b981;
        border-radius: 12px;
        animation: pulse-border 1.5s infinite;
      }
      @keyframes pulse-border {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      /* Full screen on mobile */
      @media (max-width: 640px) {
        .fast-scanner-modal {
          position: fixed;
          inset: 0;
          margin: 0;
          max-width: 100%;
          max-height: 100%;
          border-radius: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center fast-scanner-modal">
      <div className="relative w-full h-full max-w-2xl max-h-[90vh] sm:rounded-2xl overflow-hidden">
        {/* Minimal header overlay */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex justify-between items-start">
            <div className="text-white">
              <h2 className="text-2xl font-bold">Fast Scanner</h2>
              {continuous && (
                <p className="text-sm text-green-400 mt-1">
                  Continuous Mode • {scanCount} scanned
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="bg-white/20 backdrop-blur-sm text-white rounded-full p-3 hover:bg-white/30 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scanner area */}
        <div id="fast-qr-reader" className="w-full h-full bg-black"></div>

        {/* Status overlay */}
        {!isScanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-xl">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center p-6">
              <svg className="w-20 h-20 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-400 text-xl font-semibold mb-2">{error}</p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Close Scanner
              </button>
            </div>
          </div>
        )}

        {/* Success flash animation */}
        {lastScannedCode && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-green-500/30 animate-flash"></div>
          </div>
        )}

        {/* Instructions overlay */}
        {isScanning && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent text-center">
            <p className="text-white text-lg font-medium">
              Position QR code within the frame
            </p>
            <p className="text-white/80 text-sm mt-1">
              Scanner will detect automatically
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-flash {
          animation: flash 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    
    // Use Html5Qrcode directly for better mobile control
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader');
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
          
          // Mobile-optimized config
          const config = {
            fps: 10,
            qrbox: { 
              width: Math.min(250, window.innerWidth - 100), 
              height: Math.min(250, window.innerWidth - 100) 
            },
            aspectRatio: window.innerHeight / window.innerWidth,
            // Use constraints for better mobile camera handling
            videoConstraints: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          };
          
          await html5QrCode.start(
            cameraId,
            config,
            (decodedText) => {
              if (mounted) {
                // Haptic feedback
                if (navigator.vibrate) {
                  navigator.vibrate(100);
                }
                onScan(decodedText);
                html5QrCode.stop();
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
        }
      } catch (err) {
        console.error('Scanner error:', err);
        if (mounted) {
          setError('Camera access denied. Please allow camera access and try again.');
        }
      }
    };
    
    // Start scanner after a brief delay
    const timer = setTimeout(startScanner, 100);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  // Inject CSS for cleaner mobile UI
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      #qr-reader {
        position: relative;
        padding: 0;
        border: none;
      }
      #qr-reader video {
        border-radius: 12px;
        width: 100% !important;
        height: auto !important;
        object-fit: cover;
      }
      #qr-reader__scan_region {
        background: transparent !important;
      }
      #qr-reader__scan_region img {
        opacity: 0.5;
      }
      /* Mobile-specific styles */
      @media (max-width: 640px) {
        .qr-scanner-modal {
          margin: 0;
          height: 100vh;
          max-height: 100vh;
          border-radius: 0;
        }
        .qr-scanner-content {
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        #qr-reader {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-2xl max-w-lg w-full h-full sm:h-auto overflow-hidden shadow-2xl qr-scanner-modal">
        <div className="qr-scanner-content">
          {/* Header - Mobile optimized */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 sm:p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Scan QR Code</h2>
                <p className="text-purple-100 mt-1 text-sm sm:text-base">
                  Hold steady over QR code
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white bg-white bg-opacity-20 rounded-full p-3 sm:p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scanner Area - Full height on mobile */}
          <div className="flex-1 p-4 sm:p-6 bg-black sm:bg-white">
            <div id="qr-reader" className="w-full h-full rounded-lg overflow-hidden"></div>
            
            {!isScanning && !error && (
              <div className="flex items-center justify-center h-64 sm:h-64 bg-gray-900 sm:bg-gray-100 rounded-lg">
                <div className="text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-300 sm:text-gray-500">Starting camera...</p>
                </div>
              </div>
            )}
            
            {error && (
              <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg p-4">
                <div className="text-center">
                  <svg className="w-16 h-16 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-red-600 font-semibold">{error}</p>
                  <p className="text-sm text-gray-600 mt-2">Try entering the code manually below</p>
                </div>
              </div>
            )}
          </div>

          {/* Manual Entry Option - Mobile optimized */}
          <div className="border-t border-gray-200 p-4 sm:px-6 sm:py-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-600">Can't scan? Enter code:</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="6-digit code"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-lg font-mono uppercase focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center sm:text-left"
                maxLength={10}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                inputMode="text"
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
                className="px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
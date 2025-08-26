'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';

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
                // Enhanced feedback for successful scan
                warehouseFeedback.scan();
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
      warehouseFeedback.success();
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
    <div className="fixed inset-0 bg-black bg-opacity-100 z-50 flex items-center justify-center">
      <div className="bg-gradient-to-b from-gray-900 to-black rounded-none sm:rounded-warehouse-xl max-w-4xl w-full h-full sm:h-auto overflow-hidden shadow-warehouse-xl qr-scanner-modal">
        <div className="qr-scanner-content h-full flex flex-col">
          {/* Enhanced Warehouse Header */}
          <div className="bg-gradient-to-r from-purple-700 to-warehouse-info text-white p-6 border-b-4 border-blue-900">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="warehouse-icon-lg bg-white bg-opacity-20 rounded-full p-3">
                  <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" 
                      d="M12 4v1m6 11l.01-.01M12 12h.01M3 12h.01M12 19v1m8-16.364l-.707.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-warehouse-3xl font-black">SCAN QR CODE</h2>
                  <p className="text-warehouse-base text-blue-100 mt-1">
                    HOLD PHONE STEADY
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  warehouseFeedback.buttonPress();
                  onClose();
                }}
                className="min-h-touch-sm min-w-[60px] p-4 bg-red-600 hover:bg-red-700 rounded-warehouse transition-all active:scale-95 shadow-warehouse"
              >
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={4} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Enhanced Scanner Area */}
          <div className="flex-1 p-6 bg-black">
            <div id="qr-reader" className="w-full h-full rounded-warehouse overflow-hidden"></div>
            
            {!isScanning && !error && (
              <div className="flex items-center justify-center min-h-[400px] bg-gray-900 rounded-warehouse-lg border-4 border-gray-700">
                <div className="text-center">
                  <div className="warehouse-icon-2xl text-gray-400 mx-auto mb-4 animate-pulse-strong">
                    <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-warehouse-xl font-bold text-gray-300">STARTING CAMERA...</p>
                  <div className="flex justify-center gap-2 mt-4">
                    <div className="w-3 h-3 bg-warehouse-caution rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 bg-warehouse-caution rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 bg-warehouse-caution rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {error && (
              <div className="flex items-center justify-center min-h-[400px] warehouse-error rounded-warehouse-lg p-8">
                <div className="text-center">
                  <div className="warehouse-icon-2xl mx-auto mb-4">
                    <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-warehouse-2xl font-black mb-2">{error}</p>
                  <p className="text-warehouse-lg font-bold">USE MANUAL ENTRY BELOW</p>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Manual Entry - Warehouse Optimized */}
          <div className="border-t-4 border-warehouse-border-heavy p-6 bg-gradient-to-b from-gray-800 to-gray-900">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="warehouse-icon text-warehouse-caution">
                  <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="warehouse-label text-white">CAN'T SCAN? TYPE IT HERE:</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="ENTER CODE"
                className="flex-1 min-h-touch-base px-8 py-6 bg-white border-4 border-warehouse-border-heavy rounded-warehouse 
                  text-warehouse-2xl font-black uppercase text-center tracking-wider
                  focus:ring-4 focus:ring-warehouse-info focus:border-warehouse-info focus:outline-none
                  placeholder-gray-400"
                maxLength={20}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                inputMode="text"
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
                className="warehouse-btn-go min-h-touch-base px-12 text-warehouse-xl
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:border-gray-700"
              >
                USE CODE
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-warehouse-base text-gray-400">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="font-bold">TIP: CODES ARE USUALLY 6-10 CHARACTERS</span>
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
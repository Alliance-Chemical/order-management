'use client';

import { useState, useRef, useEffect } from 'react';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import { CheckIcon, XMarkIcon, CameraIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

interface PreShipInspectionWorkerProps {
  orderId: string;
  onComplete: () => void;
}

const inspectionItems = [
  { id: 'order_match', label: 'ORDER CORRECT?', icon: '📦' },
  { id: 'container_clean', label: 'CONTAINERS CLEAN?', icon: '🧹' },
  { id: 'caps_clean', label: 'CAPS CLEAN?', icon: '🔧' },
  { id: 'no_leaks', label: 'NO LEAKS?', icon: '💧' },
  { id: 'pallet_stable', label: 'PALLET STABLE?', icon: '📐' },
];

export default function PreShipInspectionWorkerView({ orderId, onComplete }: PreShipInspectionWorkerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean | 'failed'>>({});
  const [failureNotes, setFailureNotes] = useState<Record<string, string>>({});
  const [capturedPhotos, setCapturedPhotos] = useState<Array<{ url: string; lotNumbers: string[] }>>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [idempotencyKey] = useState<string>(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2,9)}`));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-start camera when reaching photo step
  useEffect(() => {
    if (currentStep === inspectionItems.length) {
      setShowCamera(true);
      startCamera();
    }
  }, [currentStep]);

  const vibrate = () => {
    if ('vibration' in navigator) {
      navigator.vibrate(50);
    }
  };

  const playSound = (success: boolean) => {
    const audio = new Audio(`data:audio/wav;base64,${success ? 'UklGRo' : 'UklGRm'}`);
    audio.play().catch(() => {});
  };

  const handlePass = () => {
    vibrate();
    playSound(true);
    const item = inspectionItems[currentStep];
    setCheckedItems(prev => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
    }, 300);
  };

  const handleFail = () => {
    vibrate();
    playSound(false);
    const item = inspectionItems[currentStep];
    setCheckedItems(prev => ({ ...prev, [item.id]: 'failed' }));
    // Show quick note input
    const note = prompt("What's wrong? (required)");
    if (note && note.trim()) {
      setFailureNotes(prev => ({ ...prev, [item.id]: note.trim() }));
      setNoteError(null);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 300);
    } else {
      setNoteError('Note required');
      // Do not advance until user provides a note
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      fileInputRef.current?.click();
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      vibrate();
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        processPhoto(dataUrl);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        processPhoto(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const processPhoto = async (photoData: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/extract-lot-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: photoData,
          orderId 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCapturedPhotos(prev => [...prev, {
          url: photoData,
          lotNumbers: data.lotNumbers || []
        }]);
        stopCamera();
        setCurrentStep(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error processing photo:', error);
      setCapturedPhotos(prev => [...prev, {
        url: photoData,
        lotNumbers: []
      }]);
      stopCamera();
      setCurrentStep(prev => prev + 1);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = async () => {
    try { warehouseFeedback.buttonPress(); } catch {}
    const hasFailures = Object.values(checkedItems).some(v => v === 'failed');
    
    try {
      setIsFinishing(true);
      await fetch(`/api/workspace/${orderId}/pre-ship-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkedItems,
          failureNotes,
          photos: capturedPhotos,
          completedAt: new Date().toISOString(),
          passed: !hasFailures,
          idempotencyKey
        }),
      });
      try { warehouseFeedback.complete(); } catch {}
      onComplete();
    } catch (error) {
      console.error('Error completing inspection:', error);
      alert('Failed to save inspection. Please try again.');
    } finally {
      setIsFinishing(false);
    }
  };

  // Current item being inspected
  const currentItem = currentStep < inspectionItems.length ? inspectionItems[currentStep] : null;
  const isPhotoStep = currentStep === inspectionItems.length;
  const isComplete = currentStep > inspectionItems.length;

  if (isComplete) {
    const hasFailures = Object.values(checkedItems).some(v => v === 'failed');
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
          
          <button
            onClick={handleComplete}
            disabled={isFinishing}
            className={`px-12 py-6 text-2xl font-bold rounded-xl ${isFinishing ? 'bg-gray-400 text-gray-700' : 'bg-white text-black'}`}
          >
            {isFinishing ? 'UPLOADING…' : 'FINISH'}
          </button>
        </div>
      </div>
    );
  }

  if (isPhotoStep) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="bg-blue-600 text-white p-4">
          <h1 className="text-2xl font-bold">CAPTURE LABEL</h1>
          <p className="text-lg opacity-90">Take photo of container labels</p>
        </div>
        
        <div className="flex-1 relative">
          {showCamera && (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Capture overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-80 h-80 border-4 border-white rounded-lg opacity-50"></div>
              </div>
            </>
          )}
          
          {isProcessing && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4 animate-spin">📸</div>
                <p className="text-xl text-white">Extracting lot numbers...</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-black flex gap-4">
          <button
            onClick={capturePhoto}
            disabled={isProcessing}
            className="flex-1 py-6 bg-blue-600 text-white text-2xl font-bold rounded-xl disabled:opacity-50"
          >
            CAPTURE
          </button>
          <button
            onClick={() => setCurrentStep(prev => prev + 1)}
            className="px-8 py-6 bg-gray-700 text-white text-xl rounded-xl"
          >
            SKIP
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Progress dots */}
      <div className="bg-gray-900 p-4 flex justify-center gap-2">
        {[...inspectionItems, { id: 'photo', label: 'PHOTO', icon: '📸' }].map((item, index) => (
          <div 
            key={item.id}
            className={`w-3 h-3 rounded-full ${
              index < currentStep ? 'bg-green-500' : 
              index === currentStep ? 'bg-white' : 
              'bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* Main inspection area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {currentItem && (
          <>
            <div className="text-8xl mb-6">{currentItem.icon}</div>
            <h1 className="text-4xl font-bold text-white text-center mb-12">
              {currentItem.label}
            </h1>
            <p className="text-xl text-gray-400 mb-8">Order #{orderId}</p>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-4 flex gap-4">
        <button
          onClick={handleFail}
          className="flex-1 py-8 bg-red-600 text-white rounded-xl flex flex-col items-center justify-center active:bg-red-700"
        >
          <XMarkIcon className="w-12 h-12 mb-2" />
          <span className="text-2xl font-bold">FAIL</span>
        </button>
        <button
          onClick={handlePass}
          className="flex-1 py-8 bg-green-600 text-white rounded-xl flex flex-col items-center justify-center active:bg-green-700"
        >
          <CheckIcon className="w-12 h-12 mb-2" />
          <span className="text-2xl font-bold">PASS</span>
        </button>
      </div>
      {noteError && (
        <div className="p-4 text-center text-yellow-300">{noteError}</div>
      )}
    </div>
  );
}

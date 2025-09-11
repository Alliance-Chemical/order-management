import { useState, useRef, useEffect, useCallback } from 'react';

interface InspectionItem {
  id: string;
  label: string;
  icon: string;
}

interface CapturedPhoto {
  base64: string;
  url: string;
  lotNumbers: string[];
  timestamp: string;
}

interface UsePreShipInspectionProps {
  orderId: string;
  onComplete: () => void;
}

const INSPECTION_ITEMS: InspectionItem[] = [
  { id: 'order_match', label: 'ORDER CORRECT?', icon: '📦' },
  { id: 'container_clean', label: 'CONTAINERS CLEAN?', icon: '🧹' },
  { id: 'caps_clean', label: 'CAPS CLEAN?', icon: '🔧' },
  { id: 'no_leaks', label: 'NO LEAKS?', icon: '💧' },
  { id: 'pallet_stable', label: 'PALLET STABLE?', icon: '📐' },
];

export function usePreShipInspection({ orderId, onComplete }: UsePreShipInspectionProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean | 'failed'>>({});
  const [failureNotes, setFailureNotes] = useState<Record<string, string>>({});
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [idempotencyKey] = useState<string>(() => 
    typeof crypto !== 'undefined' && 'randomUUID' in crypto 
      ? crypto.randomUUID() 
      : `${Date.now()}_${Math.random().toString(36).slice(2,9)}`
  );
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-start camera when reaching photo step
  useEffect(() => {
    if (currentStep === INSPECTION_ITEMS.length) {
      setShowCamera(true);
    }
  }, [currentStep]);

  const vibrate = useCallback(() => {
    if ('vibration' in navigator) {
      navigator.vibrate(50);
    }
  }, []);

  const playSound = useCallback((success: boolean) => {
    try {
      const audio = new Audio(`data:audio/wav;base64,${success ? 'UklGRo' : 'UklGRm'}`);
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  const handlePass = useCallback(() => {
    vibrate();
    playSound(true);
    const item = INSPECTION_ITEMS[currentStep];
    setCheckedItems(prev => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
    }, 300);
  }, [currentStep, vibrate, playSound]);

  const handleFail = useCallback((note: string) => {
    vibrate();
    playSound(false);
    const item = INSPECTION_ITEMS[currentStep];
    
    if (note && note.trim()) {
      setCheckedItems(prev => ({ ...prev, [item.id]: 'failed' }));
      setFailureNotes(prev => ({ ...prev, [item.id]: note.trim() }));
      setNoteError(null);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 300);
    } else {
      setNoteError('Note required for failures');
    }
  }, [currentStep, vibrate, playSound]);

  const startCamera = useCallback(async () => {
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
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  }, []);

  const processPhoto = useCallback(async (photoData: string) => {
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
          base64: photoData,
          url: photoData,
          lotNumbers: data.lotNumbers || [],
          timestamp: new Date().toISOString()
        }]);
      } else {
        throw new Error('Failed to process photo');
      }
    } catch (error) {
      console.error('Error processing photo:', error);
      setCapturedPhotos(prev => [...prev, {
        base64: photoData,
        url: photoData,
        lotNumbers: [],
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [orderId]);

  const capturePhoto = useCallback(() => {
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
  }, [processPhoto, vibrate]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        processPhoto(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  }, [processPhoto]);

  const deletePhoto = useCallback((index: number) => {
    vibrate();
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  }, [vibrate]);

  const handleComplete = useCallback(async () => {
    const hasFailures = Object.values(checkedItems).some(v => v === 'failed');
    
    try {
      setIsFinishing(true);
      const response = await fetch(`/api/workspace/${orderId}/pre-ship-complete`, {
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

      if (!response.ok) {
        throw new Error('Failed to save inspection');
      }

      onComplete();
    } catch (error) {
      console.error('Error completing inspection:', error);
      setNoteError('Failed to save inspection. Please try again.');
    } finally {
      setIsFinishing(false);
    }
  }, [checkedItems, failureNotes, capturedPhotos, idempotencyKey, orderId, onComplete]);

  const skipToCompletion = useCallback(() => {
    setCurrentStep(INSPECTION_ITEMS.length + 1);
  }, []);

  // Computed values
  const currentItem = currentStep < INSPECTION_ITEMS.length ? INSPECTION_ITEMS[currentStep] : null;
  const isPhotoStep = currentStep === INSPECTION_ITEMS.length;
  const isComplete = currentStep > INSPECTION_ITEMS.length;
  const hasFailures = Object.values(checkedItems).some(v => v === 'failed');
  const progress = (currentStep / (INSPECTION_ITEMS.length + 1)) * 100;

  return {
    // State
    currentStep,
    checkedItems,
    failureNotes,
    capturedPhotos,
    showCamera,
    isProcessing,
    isFinishing,
    noteError,
    
    // Refs
    videoRef,
    canvasRef,
    fileInputRef,
    
    // Computed
    currentItem,
    isPhotoStep,
    isComplete,
    hasFailures,
    progress,
    inspectionItems: INSPECTION_ITEMS,
    
    // Actions
    handlePass,
    handleFail,
    startCamera,
    stopCamera,
    capturePhoto,
    handleFileUpload,
    deletePhoto,
    handleComplete,
    skipToCompletion,
    setNoteError,
  };
}
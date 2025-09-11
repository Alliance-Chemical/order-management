'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CameraIcon } from '@heroicons/react/24/solid';

interface CapturedPhoto {
  url: string;
  lotNumbers: string[];
}

interface PreShipPhotoCaptureProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  showCamera: boolean;
  isProcessing: boolean;
  capturedPhotos: CapturedPhoto[];
  onCapture: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeletePhoto: (index: number) => void;
  onContinue: () => void;
}

export function PreShipPhotoCapture({
  videoRef,
  canvasRef,
  fileInputRef,
  showCamera,
  isProcessing,
  capturedPhotos,
  onCapture,
  onFileUpload,
  onDeletePhoto,
  onContinue,
}: PreShipPhotoCaptureProps) {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-bold">CAPTURE LABELS</h1>
        <p className="text-lg opacity-90">Take photos of container labels</p>
        <p className="text-sm opacity-75">{capturedPhotos.length} photo(s) captured</p>
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
            {/* Guide text */}
            <div className="absolute top-4 left-4 right-4 text-center text-white text-sm opacity-75">
              Position label within the frame
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
        
        {/* Show captured photos as thumbnails */}
        {capturedPhotos.length > 0 && (
          <div className="absolute bottom-20 left-4 right-4">
            <div className="bg-black bg-opacity-75 rounded-lg p-2">
              <div className="flex gap-2 overflow-x-auto">
                {capturedPhotos.map((photo, index) => (
                  <div key={index} className="relative flex-shrink-0">
                    <img 
                      src={photo.url} 
                      alt={`Captured ${index + 1}`}
                      className="w-16 h-16 object-cover rounded border-2 border-white"
                    />
                    <button
                      onClick={() => onDeletePhoto(index)}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                      aria-label="Delete photo"
                    >
                      ×
                    </button>
                    {photo.lotNumbers.length > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-green-500 text-white text-xs text-center py-0.5">
                        {photo.lotNumbers.length}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 bg-black flex gap-4">
        <Button
          onClick={onCapture}
          disabled={isProcessing}
          variant="info"
          size="xlarge"
          className="flex-1"
        >
          <CameraIcon className="w-8 h-8 mr-2" />
          {capturedPhotos.length === 0 ? 'CAPTURE' : 'CAPTURE MORE'}
        </Button>
        <Button
          onClick={onContinue}
          variant="go"
          size="xlarge"
          className="flex-1"
        >
          {capturedPhotos.length === 0 ? 'SKIP' : 'CONTINUE'}
        </Button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileUpload}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
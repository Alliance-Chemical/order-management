'use client';

import { useState, useEffect } from 'react';
import { Play, X } from 'lucide-react';

interface QuickTutorialProps {
  show: boolean;
  onClose: () => void;
}

const tutorialSteps = [
  {
    title: "Welcome! 👋",
    description: "Let's learn how to use this app",
    visual: "👋",
    duration: 2000
  },
  {
    title: "Step 1: Find Your Order",
    description: "Look for your order number",
    visual: "📋",
    duration: 3000
  },
  {
    title: "Step 2: Tap to Start",
    description: "Tap the green button",
    visual: "👆",
    duration: 3000
  },
  {
    title: "Step 3: Scan QR Codes",
    description: "Point camera at labels",
    visual: "📱",
    duration: 3000
  },
  {
    title: "All Done!",
    description: "You're ready to go!",
    visual: "🎉",
    duration: 2000
  }
];

export function QuickTutorial({ show, onClose }: QuickTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isPlaying && currentStep < tutorialSteps.length) {
      const timer = setTimeout(() => {
        if (currentStep === tutorialSteps.length - 1) {
          setIsPlaying(false);
          setTimeout(onClose, 500);
        } else {
          setCurrentStep(currentStep + 1);
        }
      }, tutorialSteps[currentStep].duration);

      return () => clearTimeout(timer);
    }
  }, [currentStep, isPlaying, onClose]);

  const startTutorial = () => {
    setCurrentStep(0);
    setIsPlaying(true);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg"
        >
          <X className="w-6 h-6" />
        </button>

        {!isPlaying ? (
          <div className="text-center">
            <div className="text-6xl mb-6">🎓</div>
            <h2 className="text-2xl font-bold mb-4">Quick Tutorial</h2>
            <p className="text-lg text-gray-600 mb-8">
              Learn the basics in 15 seconds
            </p>
            <button
              onClick={startTutorial}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-3 mx-auto"
            >
              <Play className="w-6 h-6" />
              Start Tutorial
            </button>
          </div>
        ) : (
          <div className="text-center animate-fade-in">
            <div className="text-8xl mb-6 animate-bounce">
              {tutorialSteps[currentStep].visual}
            </div>
            <h3 className="text-2xl font-bold mb-3">
              {tutorialSteps[currentStep].title}
            </h3>
            <p className="text-lg text-gray-700">
              {tutorialSteps[currentStep].description}
            </p>
            
            {/* Progress bar */}
            <div className="mt-8 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
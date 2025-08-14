'use client';

import { useState, useEffect } from 'react';
import { X, Volume2, ChevronLeft, ChevronRight } from 'lucide-react';

interface InstructionStep {
  title: string;
  description: string;
  visual: string; // emoji or icon
  action?: string; // what to do
}

interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  steps: InstructionStep[];
}

export function InstructionModal({ isOpen, onClose, title, steps }: InstructionModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      stopSpeaking();
    }
  }, [isOpen]);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.onend = () => setIsSpeaking(false);
      setIsSpeaking(true);
      speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="mt-2 text-sm opacity-90">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Visual */}
          <div className="text-8xl text-center mb-6">
            {step.visual}
          </div>

          {/* Step Title */}
          <h3 className="text-2xl font-bold text-center mb-4 text-gray-800">
            {step.title}
          </h3>

          {/* Description */}
          <p className="text-lg text-center text-gray-700 mb-6 leading-relaxed">
            {step.description}
          </p>

          {/* Action Button */}
          {step.action && (
            <div className="bg-green-100 border-2 border-green-400 rounded-xl p-4 mb-6">
              <p className="text-center text-lg font-semibold text-green-800">
                👆 {step.action}
              </p>
            </div>
          )}

          {/* Speak Button */}
          <button
            onClick={() => speakText(`${step.title}. ${step.description}. ${step.action || ''}`)}
            className={`w-full mb-4 p-4 rounded-xl flex items-center justify-center gap-3 transition ${
              isSpeaking 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`}
          >
            <Volume2 className="w-6 h-6" />
            <span className="text-lg font-semibold">
              {isSpeaking ? 'Speaking...' : 'Read To Me'}
            </span>
          </button>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`flex-1 p-4 rounded-xl flex items-center justify-center gap-2 transition ${
                currentStep === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="text-lg font-semibold">Back</span>
            </button>

            <button
              onClick={handleNext}
              disabled={currentStep === steps.length - 1}
              className={`flex-1 p-4 rounded-xl flex items-center justify-center gap-2 transition ${
                currentStep === steps.length - 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <span className="text-lg font-semibold">Next</span>
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition ${
                  index === currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import React from 'react';
import ProgressBar from '@/components/ui/ProgressBar';

interface PreShipProgressProps {
  progress: number;
  currentStep: number;
  items: Array<{ id: string; label: string; icon: string }>;
}

export function PreShipProgress({ progress, currentStep, items }: PreShipProgressProps) {
  const allItems = [...items, { id: 'photo', label: 'PHOTO', icon: '📸' }];
  
  return (
    <div className="bg-gray-900 p-4">
      <ProgressBar
        value={progress}
        label="Inspection Progress"
        showPercentage={false}
        variant={progress === 100 ? "success" : "default"}
        animated={true}
      />
      {/* Progress dots for individual items */}
      <div className="flex justify-center gap-2 mt-2">
        {allItems.map((item, index) => (
          <div 
            key={item.id}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index < currentStep ? 'bg-green-500' : 
              index === currentStep ? 'bg-white animate-pulse' : 
              'bg-gray-700'
            }`}
            title={item.label}
          />
        ))}
      </div>
    </div>
  );
}
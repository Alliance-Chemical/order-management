'use client';

import React from 'react';
import ProgressBar from '@/components/ui/ProgressBar';

interface Container {
  id: string;
  number: number;
  scanned: boolean;
  inspected: boolean;
  issues: string[];
  qrData?: string;
}

interface ContainerListProps {
  containers: Container[];
  progress: number;
  scanSpeed: number;
  getContainerStatus: (index: number) => string;
}

export function ContainerList({
  containers,
  progress,
  scanSpeed,
  getContainerStatus,
}: ContainerListProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Container Progress</h2>
        <ProgressBar
          value={progress}
          label="Inspection Progress"
          showPercentage={true}
          variant={progress === 100 ? "success" : "default"}
          animated={progress < 100}
        />
      </div>
      
      {/* Container Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {containers.map((container, idx) => {
          const status = getContainerStatus(idx);
          return (
            <div
              key={container.id}
              className={`
                aspect-square rounded-lg flex items-center justify-center font-bold text-sm
                transition-all duration-300 transform
                ${status === 'completed' ? 'bg-green-500 text-white scale-95' : ''}
                ${status === 'current' ? 'bg-blue-500 text-white animate-pulse scale-110 ring-4 ring-blue-200' : ''}
                ${status === 'scanning' ? 'bg-yellow-500 text-white' : ''}
                ${status === 'pending' ? 'bg-gray-200 text-gray-500' : ''}
              `}
            >
              {status === 'completed' ? '✓' : container.number}
            </div>
          );
        })}
      </div>

      {/* Speed indicator */}
      {scanSpeed > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Scan Speed:</span>
            <span className="text-sm font-bold text-green-600">
              {scanSpeed} containers/sec
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

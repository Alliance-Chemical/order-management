'use client';

import React from 'react';

interface InspectionStatsProps {
  scanned: number;
  inspected: number;
  remaining: number;
}

export function InspectionStats({ scanned, inspected, remaining }: InspectionStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
        <p className="text-2xl font-bold text-gray-900">
          {scanned}
        </p>
        <p className="text-sm text-gray-600">Scanned</p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
        <p className="text-2xl font-bold text-green-600">
          {inspected}
        </p>
        <p className="text-sm text-gray-600">Inspected</p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
        <p className="text-2xl font-bold text-blue-600">
          {remaining}
        </p>
        <p className="text-sm text-gray-600">Remaining</p>
      </div>
    </div>
  );
}
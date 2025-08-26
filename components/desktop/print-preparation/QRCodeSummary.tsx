'use client';

import { DocumentCheckIcon } from '@heroicons/react/24/solid';

interface LabelSummary {
  drums: number;
  totes: number;
  pallets: number;
  containers: number; // Generic container count
}

interface QRCodeSummaryProps {
  summary: LabelSummary;
  hasUnassignedItems: boolean;
}

export default function QRCodeSummary({ summary, hasUnassignedItems }: QRCodeSummaryProps) {
  const totalLabels = summary.drums + summary.totes + summary.pallets + (summary.containers || 0);

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
        <DocumentCheckIcon className="h-4 w-4 text-gray-500" />
        Label Summary
      </h3>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        {summary.drums > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Drum Labels:</span>
            <span className="font-medium text-gray-900">{summary.drums}</span>
          </div>
        )}
        
        {summary.totes > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Tote Labels:</span>
            <span className="font-medium text-gray-900">{summary.totes}</span>
          </div>
        )}
        
        {summary.pallets > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Pallet Labels:</span>
            <span className="font-medium text-gray-900">{summary.pallets}</span>
          </div>
        )}
        
        {(summary.containers || 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Container Labels:</span>
            <span className="font-medium text-gray-900">{summary.containers}</span>
          </div>
        )}
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total Labels to Print:</span>
          <span className="text-lg font-bold text-gray-900">{totalLabels}</span>
        </div>
      </div>

      {hasUnassignedItems && (
        <div className="mt-3 p-2 bg-blue-100 border border-blue-300 rounded">
          <p className="text-xs text-blue-800">
            ℹ️ Ready to print container labels for all order items.
          </p>
        </div>
      )}
    </div>
  );
}
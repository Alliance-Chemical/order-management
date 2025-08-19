'use client';

import { DocumentCheckIcon } from '@heroicons/react/24/solid';

interface LabelSummary {
  master: number;
  source: number;
  drums: number;
  totes: number;
  pallets: number;
}

interface QRCodeSummaryProps {
  summary: LabelSummary;
  hasUnassignedItems: boolean;
}

export default function QRCodeSummary({ summary, hasUnassignedItems }: QRCodeSummaryProps) {
  const totalLabels = summary.master + summary.source + summary.drums + summary.totes + summary.pallets;

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
        <DocumentCheckIcon className="h-4 w-4 text-gray-500" />
        Label Summary
      </h3>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        {summary.master > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Master Labels:</span>
            <span className="font-medium text-blue-600">{summary.master}</span>
          </div>
        )}
        
        {summary.source > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Source Labels:</span>
            <span className="font-medium text-orange-600">{summary.source}</span>
          </div>
        )}
        
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
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total Labels to Print:</span>
          <span className="text-lg font-bold text-gray-900">{totalLabels}</span>
        </div>
      </div>

      {hasUnassignedItems && (
        <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded">
          <p className="text-xs text-yellow-800">
            ⚠️ Some pump & fill items don't have source containers assigned. 
            Source labels will only be created for assigned containers.
          </p>
        </div>
      )}
    </div>
  );
}
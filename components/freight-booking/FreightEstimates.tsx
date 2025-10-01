'use client';

import React from 'react';
import { HiCurrencyDollar, HiClock } from 'react-icons/hi';
import type { EstimatedCost, EstimatedTransitDays } from '@/types/components';

interface FreightEstimatesProps {
  estimatedCost?: EstimatedCost;
  estimatedTransitDays?: EstimatedTransitDays;
}

export const FreightEstimates = React.memo(function FreightEstimates({
  estimatedCost,
  estimatedTransitDays,
}: FreightEstimatesProps) {
  if (!estimatedCost && !estimatedTransitDays) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {estimatedCost && (
        <div className="rounded-lg border p-3 dark:border-gray-600">
          <div className="flex items-center">
            <HiCurrencyDollar className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
            <span className="ml-2 text-sm font-medium">Estimated Cost</span>
          </div>
          <div className="mt-1 text-lg font-semibold" aria-label={`Estimated cost: $${estimatedCost.average.toFixed(2)}`}>
            ${estimatedCost.average.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            Range: ${estimatedCost.low.toFixed(2)} - $
            {estimatedCost.high.toFixed(2)}
          </div>
        </div>
      )}

      {estimatedTransitDays && (
        <div className="rounded-lg border p-3 dark:border-gray-600">
          <div className="flex items-center">
            <HiClock className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="ml-2 text-sm font-medium">Transit Time</span>
          </div>
          <div className="mt-1 text-lg font-semibold" aria-label={`Estimated transit time: ${estimatedTransitDays.typical} days`}>
            {estimatedTransitDays.typical} days
          </div>
          <div className="text-xs text-gray-500">
            Range: {estimatedTransitDays.min}-
            {estimatedTransitDays.max} days
          </div>
        </div>
      )}
    </div>
  );
});

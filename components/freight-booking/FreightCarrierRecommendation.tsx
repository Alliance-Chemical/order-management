'use client';

import React from 'react';
import { HiTruck } from 'react-icons/hi';
import { Progress } from '@/components/ui/progress';
import type { FreightCarrier, FreightService } from '@/types/components';

interface FreightCarrierRecommendationProps {
  carrier: FreightCarrier;
  service: FreightService;
  getConfidenceColor: (confidence: number) => string;
}

export const FreightCarrierRecommendation = React.memo(function FreightCarrierRecommendation({
  carrier,
  service,
  getConfidenceColor,
}: FreightCarrierRecommendationProps) {
  return (
    <div className="rounded-lg border p-4 dark:border-gray-600">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <HiTruck className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span className="ml-2 font-medium">Carrier & Service</span>
        </div>
        <Progress
          progress={carrier.confidence * 100}
          size="sm"
          color={getConfidenceColor(carrier.confidence)}
          className="w-32"
          aria-label={`Carrier confidence: ${Math.round(carrier.confidence * 100)}%`}
        />
      </div>
      <div className="mt-2">
        <div className="text-lg font-semibold text-gray-900 dark:text-white">
          {carrier.name} - {service.type}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {carrier.reasoning}
        </p>
      </div>
    </div>
  );
});

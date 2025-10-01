'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { FreightAccessorial } from '@/types/components';

interface FreightAccessorialsProps {
  accessorials: FreightAccessorial[];
  onToggle: (accessorial: FreightAccessorial) => void;
}

export const FreightAccessorials = React.memo(function FreightAccessorials({
  accessorials,
  onToggle,
}: FreightAccessorialsProps) {
  if (accessorials.length === 0) return null;

  return (
    <div className="rounded-lg border p-4 dark:border-gray-600">
      <h4 className="mb-3 font-medium">Recommended Accessorials</h4>
      <div className="space-y-2" role="group" aria-label="Freight accessorials">
        {accessorials.map((accessorial) => (
          <div
            key={accessorial.type}
            className="flex items-center justify-between rounded-lg bg-gray-50 p-2 dark:bg-gray-700"
          >
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={accessorial.recommended}
                onChange={() => onToggle(accessorial)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                id={`accessorial-${accessorial.type}`}
                aria-label={`${accessorial.type} accessorial`}
              />
              <label
                htmlFor={`accessorial-${accessorial.type}`}
                className="ml-2 text-sm cursor-pointer"
              >
                {accessorial.type}
              </label>
              {accessorial.confidence >= 0.8 && (
                <Badge size="xs" color="success" className="ml-2">
                  Recommended
                </Badge>
              )}
            </div>
            <button
              onClick={() => window.alert(accessorial.reasoning)}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              aria-label={`Why ${accessorial.type} is recommended`}
            >
              Why?
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

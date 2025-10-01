'use client';

import React from 'react';
import { HiInformationCircle } from 'react-icons/hi';

interface FreightAIInsightsProps {
  insights: string[];
}

export const FreightAIInsights = React.memo(function FreightAIInsights({
  insights,
}: FreightAIInsightsProps) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20" role="region" aria-label="AI insights">
      <div className="flex items-center">
        <HiInformationCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span className="ml-2 text-sm font-medium text-blue-900 dark:text-blue-100">
          AI Insights
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {insights.map((insight, index) => (
          <li
            key={index}
            className="text-sm text-blue-800 dark:text-blue-200"
          >
            • {insight}
          </li>
        ))}
      </ul>
    </div>
  );
});

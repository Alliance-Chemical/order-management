'use client';

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

type FetchError = Error & { info?: unknown; status?: number };

function isFetchError(error: unknown): error is FetchError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

// Default fetcher with error handling
const fetcher = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  
  if (!res.ok) {
    const error: FetchError = new Error('An error occurred while fetching the data.');
    // Attach extra info to the error object
    error.info = await res.json().catch(() => undefined);
    error.status = res.status;
    throw error;
  }
  
  return res.json();
};

// SWR global configuration
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // Refresh data every 5 seconds for real-time updates
        refreshInterval: 5000,
        // Revalidate on window focus
        revalidateOnFocus: true,
        // Retry on error with exponential backoff
        errorRetryCount: 3,
        errorRetryInterval: 1000,
        // Keep previous data while revalidating
        keepPreviousData: true,
        // Dedupe requests within 2 seconds
        dedupingInterval: 2000,
        // Focus throttle interval
        focusThrottleInterval: 5000,
        // Load data from cache first, then revalidate
        revalidateIfStale: true,
        // Revalidate on mount
        revalidateOnMount: true,
        // Fallback data for initial load
        fallback: {},
        // Global error handler
        onError: (error, key) => {
          const status = isFetchError(error) && typeof error.status === 'number' ? error.status : undefined;
          if (status !== 403 && status !== 404) {
            console.error(`SWR Error for ${key}:`, error);
          }
        },
        // Success handler for metrics
        onSuccess: (data, key) => {
          // Could add analytics here
          console.debug(`SWR Success for ${key}`);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

'use client';

import React, { createContext } from 'react';

// Stub implementation for freight telemetry
const FreightTelemetryContext = createContext({});

export function FreightTelemetryProvider({ children }: { children: React.ReactNode }) {
  return (
    <FreightTelemetryContext.Provider value={{}}>
      {children}
    </FreightTelemetryContext.Provider>
  );
}

export function useFreightActionTracking() {
  return {
    trackAction: (action: string, data?: Record<string, unknown>) => {
      console.log('Freight action tracked:', action, data);
    }
  };
}

export function useFreightTelemetry() {
  return {
    trackEvent: (event: string, data?: Record<string, unknown>) => {
      console.log('Freight telemetry event:', event, data);
    }
  };
}

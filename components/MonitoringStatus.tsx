'use client';

import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export function MonitoringStatus() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  useEffect(() => {
    // Check if Sentry is initialized
    const client = Sentry.getClient();
    setIsMonitoring(!!client && !!process.env.NEXT_PUBLIC_SENTRY_DSN);
  }, []);
  
  if (!isMonitoring || process.env.NODE_ENV === 'production') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium shadow-sm">
      🛡️ Error monitoring active
    </div>
  );
}
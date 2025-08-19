'use client';

import { useState, useEffect } from 'react';

export function ConnectionStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'syncing'>('online');
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => {
      setStatus('syncing');
      // Check for queued items
      const queue = localStorage.getItem('inspection_queue');
      if (queue) {
        const items = JSON.parse(queue);
        setQueueSize(items.length);
        if (items.length > 0) {
          // Start syncing
          setTimeout(() => {
            setStatus('online');
            setQueueSize(0);
            setLastSync(new Date());
          }, 2000);
        } else {
          setStatus('online');
        }
      } else {
        setStatus('online');
      }
    };

    const handleOffline = () => {
      setStatus('offline');
    };

    // Check initial status
    if (!navigator.onLine) {
      setStatus('offline');
    }

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic sync check
    const syncInterval = setInterval(() => {
      if (navigator.onLine && status === 'online') {
        setLastSync(new Date());
      }
    }, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
  }, [status]);

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'syncing':
        return 'bg-yellow-500 animate-pulse';
      case 'offline':
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'online':
        return 'Connected';
      case 'syncing':
        return `Syncing (${queueSize} items)`;
      case 'offline':
        return 'Offline Mode';
    }
  };

  const getTimeSinceSync = () => {
    const now = new Date();
    const diff = now.getTime() - lastSync.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-3 flex items-center gap-3 border border-gray-200">
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          {status === 'syncing' && (
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-yellow-500 animate-ping" />
          )}
        </div>
        
        <div>
          <div className="font-semibold text-sm text-gray-900">
            {getStatusText()}
          </div>
          {status === 'online' && (
            <div className="text-xs text-gray-500">
              Last sync: {getTimeSinceSync()}
            </div>
          )}
          {status === 'offline' && queueSize > 0 && (
            <div className="text-xs text-orange-600">
              {queueSize} pending items
            </div>
          )}
        </div>

        {/* Optional: Add manual sync button */}
        {status === 'online' && (
          <button
            onClick={() => {
              setStatus('syncing');
              setTimeout(() => {
                setStatus('online');
                setLastSync(new Date());
              }, 1000);
            }}
            className="ml-2 p-1 hover:bg-gray-100 rounded"
            title="Sync now"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
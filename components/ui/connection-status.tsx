'use client';

import { useState, useEffect } from 'react';
import { inspectionQueue } from '@/lib/services/offline/inspection-queue';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

export function ConnectionStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'syncing'>('online');
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [queueSize, setQueueSize] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Update queue status from inspection queue service
    const updateQueueStatus = () => {
      const queueStatus = inspectionQueue.getStatus();
      setQueueSize(queueStatus.queueLength);
      setFailedCount(queueStatus.failedCount);

      if (queueStatus.processing) {
        setStatus('syncing');
      } else if (!queueStatus.online) {
        setStatus('offline');
      } else {
        setStatus('online');
      }
    };

    // Monitor online/offline status
    const handleOnline = () => {
      updateQueueStatus();
      setLastSync(new Date());
    };

    const handleOffline = () => {
      setStatus('offline');
    };

    // Check initial status
    updateQueueStatus();

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic status check
    const statusInterval = setInterval(updateQueueStatus, 3000); // Every 3 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(statusInterval);
    };
  }, []);

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

  const handleRetryFailed = () => {
    inspectionQueue.retryFailed();
    setLastSync(new Date());
  };

  const handleClearQueue = () => {
    if (confirm('Clear all queued items? This will discard pending inspection data.')) {
      inspectionQueue.clearQueue();
    }
  };

  const handleManualSync = () => {
    setStatus('syncing');
    setLastSync(new Date());
    // The queue will auto-process when online
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-200">
        {/* Main Status Bar */}
        <div
          className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
            {status === 'syncing' && (
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-yellow-500 animate-ping" />
            )}
          </div>

          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              {getStatusText()}
              {failedCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {failedCount} failed
                </span>
              )}
            </div>
            {status === 'online' && (
              <div className="text-xs text-gray-500">
                Last sync: {getTimeSinceSync()}
              </div>
            )}
            {(status === 'offline' || status === 'syncing') && queueSize > 0 && (
              <div className="text-xs text-orange-600">
                {queueSize} pending items
              </div>
            )}
          </div>

          {/* Expand/Collapse indicator */}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Expanded Queue Management */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-3 space-y-2 animate-fade-in">
            <div className="text-xs font-medium text-gray-700 uppercase tracking-wide">
              Queue Management
            </div>

            <div className="space-y-2">
              {/* Manual Sync Button */}
              {status === 'online' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  className="w-full justify-start text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Sync Now
                </Button>
              )}

              {/* Retry Failed Items */}
              {failedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryFailed}
                  className="w-full justify-start text-xs text-orange-700 border-orange-300 hover:bg-orange-50"
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Retry {failedCount} Failed Items
                </Button>
              )}

              {/* Clear Queue */}
              {queueSize > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearQueue}
                  className="w-full justify-start text-xs text-red-700 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Clear Queue ({queueSize})
                </Button>
              )}

              {/* Status Info */}
              {queueSize === 0 && failedCount === 0 && (
                <div className="text-xs text-gray-500 text-center py-2">
                  ✓ All items synced successfully
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
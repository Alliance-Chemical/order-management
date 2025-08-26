'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';

// Workspace real-time data hook
export function useWorkspace(workspaceId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    workspaceId ? `/api/workspaces/${workspaceId}` : null,
    {
      // More frequent updates for active workspaces
      refreshInterval: 2000,
      // Keep showing old data while loading new
      keepPreviousData: true,
    }
  );

  return {
    workspace: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Orders list with real-time updates
export function useOrders(status?: string) {
  const params = status ? `?status=${status}` : '';
  const { data, error, isLoading } = useSWR(
    `/api/orders${params}`,
    {
      refreshInterval: 3000,
    }
  );

  return {
    orders: data?.orders || [],
    isLoading,
    isError: error,
  };
}

// QR code validation hook
export function useQRCode(code: string | undefined) {
  const { data, error, isLoading } = useSWR(
    code ? `/api/qr/${code}` : null,
    {
      // Cache QR codes for longer
      refreshInterval: 10000,
      revalidateOnFocus: false,
    }
  );

  return {
    qrData: data,
    isLoading,
    isError: error,
    isValid: data?.valid || false,
  };
}

// Queue status monitoring
export function useQueueStatus() {
  const { data, error, isLoading } = useSWR(
    '/api/queue/status',
    {
      refreshInterval: 1000, // Update every second for real-time monitoring
    }
  );

  return {
    queue: data,
    isLoading,
    isError: error,
  };
}

// Worker task assignments
export function useWorkerTasks(workerId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    workerId ? `/api/workers/${workerId}/tasks` : null,
    {
      refreshInterval: 2000,
    }
  );

  return {
    tasks: data?.tasks || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Mutation hook for updating workspace
export function useUpdateWorkspace(workspaceId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/workspaces/${workspaceId}`,
    async (url, { arg }: { arg: any }) => {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      
      if (!res.ok) throw new Error('Failed to update workspace');
      return res.json();
    },
    {
      // Optimistically update the UI
      optimisticData: (current: any, newData: any) => ({
        ...current,
        ...newData,
      }),
      // Revalidate after mutation
      revalidate: true,
      // Rollback on error
      rollbackOnError: true,
    }
  );

  return {
    updateWorkspace: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Batch operations hook
export function useBatchOperation() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/batch',
    async (url, { arg }: { arg: { operation: string; items: any[] } }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      
      if (!res.ok) throw new Error('Batch operation failed');
      return res.json();
    }
  );

  return {
    executeBatch: trigger,
    isExecuting: isMutating,
    error,
  };
}

// Global cache invalidation helper
export function invalidateCache(patterns: string[]) {
  patterns.forEach(pattern => {
    mutate(
      key => typeof key === 'string' && key.startsWith(pattern),
      undefined,
      { revalidate: true }
    );
  });
}

// Prefetch helper for anticipated navigation
export async function prefetchWorkspace(workspaceId: string) {
  const data = await fetch(`/api/workspaces/${workspaceId}`).then(res => res.json());
  mutate(`/api/workspaces/${workspaceId}`, data, false);
}

// Real-time subscription simulation (until WebSockets are added)
export function useRealTimeWorkspace(workspaceId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    workspaceId ? `/api/workspaces/${workspaceId}/realtime` : null,
    {
      // Very frequent updates for real-time feel
      refreshInterval: 1000,
      // Don't revalidate on focus to avoid flicker
      revalidateOnFocus: false,
      // Keep old data while fetching
      keepPreviousData: true,
      // Dedupe within 500ms
      dedupingInterval: 500,
    }
  );

  return {
    workspace: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Warehouse statistics dashboard
export function useWarehouseStats(timeRange: 'day' | 'week' | 'month' = 'day') {
  const { data, error, isLoading } = useSWR(
    `/api/stats/warehouse?range=${timeRange}`,
    {
      // Update every 30 seconds for dashboard
      refreshInterval: 30000,
      // Cache for longer since stats don't change rapidly
      revalidateOnFocus: false,
    }
  );

  return {
    stats: data,
    isLoading,
    isError: error,
  };
}
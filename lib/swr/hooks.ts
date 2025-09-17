'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';

type WorkspaceData = Record<string, unknown>;
type WorkspaceUpdatePayload = Record<string, unknown>;
type BatchOperationPayload = { operation: string; items: unknown[] };
type FreightSuggestionContext = Record<string, unknown>;
type HazmatSuggestionContext = Record<string, unknown>;
type FreightBookingPayload = Record<string, unknown>;

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
    async (url, { arg }: { arg: WorkspaceUpdatePayload }) => {
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
      optimisticData: (current: WorkspaceData | undefined, newData: WorkspaceUpdatePayload): WorkspaceData => ({
        ...(current ?? {}),
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
    async (url, { arg }: { arg: BatchOperationPayload }) => {
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

// Freight Booking SWR Hooks

// Freight order tracking
export function useFreightOrder(orderId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    orderId ? `/api/freight-booking/orders/${orderId}` : null,
    {
      refreshInterval: 5000, // Update every 5 seconds for freight tracking
      keepPreviousData: true,
    }
  );

  return {
    order: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Freight quotes fetching
export function useFreightQuotes(orderId: string | undefined) {
  const { data, error, isLoading } = useSWR(
    orderId ? `/api/freight-booking/quotes/${orderId}` : null,
    {
      // Cache quotes for 5 minutes since rates change frequently
      refreshInterval: 300000,
      revalidateOnFocus: false,
    }
  );

  return {
    quotes: data?.quotes || [],
    isLoading,
    isError: error,
  };
}

// AI freight suggestions
export function useFreightSuggestions(orderContext: FreightSuggestionContext | undefined) {
  const contextKey = orderContext ? JSON.stringify(orderContext).slice(0, 100) : null;
  const { data, error, isLoading } = useSWR(
    contextKey ? `/api/freight-booking/freight/suggest` : null,
    async () => {
      if (!orderContext) return null;
      const res = await fetch('/api/freight-booking/freight/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderContext),
      });
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      return res.json();
    },
    {
      // Cache AI suggestions for 1 hour
      refreshInterval: 3600000,
      revalidateOnFocus: false,
    }
  );

  return {
    suggestion: data?.suggestion,
    confidence: data?.confidence,
    reasoning: data?.reasoning,
    isLoading,
    isError: error,
  };
}

// Freight booking mutation
export function useCreateFreightBooking() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/freight-booking/capture-order',
    async (url, { arg }: { arg: FreightBookingPayload }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      
      if (!res.ok) throw new Error('Failed to create freight booking');
      return res.json();
    },
    {
      // Revalidate related data after booking
      onSuccess: () => {
        // Invalidate freight orders list
        mutate(key => typeof key === 'string' && key.startsWith('/api/freight-booking/orders'));
        // Invalidate workspace data since booking affects workspace
        mutate(key => typeof key === 'string' && key.startsWith('/api/workspaces'));
      },
    }
  );

  return {
    createBooking: trigger,
    isCreating: isMutating,
    error,
  };
}

// Hazmat freight suggestions
export function useHazmatSuggestions(hazmatContext: HazmatSuggestionContext | undefined) {
  const contextKey = hazmatContext ? JSON.stringify(hazmatContext).slice(0, 100) : null;
  const { data, error, isLoading } = useSWR(
    contextKey ? `/api/freight-booking/freight/hazmat-suggest` : null,
    async () => {
      if (!hazmatContext) return null;
      const res = await fetch('/api/freight-booking/freight/hazmat-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hazmatContext),
      });
      if (!res.ok) throw new Error('Failed to fetch hazmat suggestions');
      return res.json();
    },
    {
      // Cache hazmat suggestions for longer since regulations change slowly
      refreshInterval: 7200000, // 2 hours
      revalidateOnFocus: false,
    }
  );

  return {
    suggestion: data?.suggestion,
    confidence: data?.confidence,
    complianceScore: data?.complianceScore,
    riskAssessment: data?.riskAssessment,
    hazmatRequirements: data?.suggestion?.hazmatRequirements || [],
    isLoading,
    isError: error,
  };
}

// Freight order history
export function useFreightOrderHistory(workspaceId: string | undefined, limit = 20) {
  const { data, error, isLoading } = useSWR(
    workspaceId ? `/api/freight-booking/history/${workspaceId}?limit=${limit}` : null,
    {
      // History doesn't change often, update every 2 minutes
      refreshInterval: 120000,
      revalidateOnFocus: false,
    }
  );

  return {
    history: data?.orders || [],
    isLoading,
    isError: error,
  };
}

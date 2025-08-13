import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface OptimisticUpdateOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: string[];
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

export function useOptimisticUpdate<TData = unknown, TVariables = unknown>({
  mutationFn,
  queryKey,
  onSuccess,
  onError,
}: OptimisticUpdateOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const [isOptimistic, setIsOptimistic] = useState(false);

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      setIsOptimistic(true);
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically update
      queryClient.setQueryData(queryKey, (old: any) => {
        // Merge the optimistic update
        if (typeof variables === 'object' && typeof old === 'object') {
          return { ...old, ...variables };
        }
        return variables;
      });
      
      return { previousData };
    },
    onError: (error, variables, context) => {
      setIsOptimistic(false);
      
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      onError?.(error as Error);
    },
    onSuccess: (data) => {
      setIsOptimistic(false);
      
      // Update with server response
      queryClient.setQueryData(queryKey, data);
      onSuccess?.(data);
    },
    onSettled: () => {
      setIsOptimistic(false);
      
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
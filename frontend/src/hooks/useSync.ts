import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { SyncStatus } from '../types';

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status'],
    queryFn: async (): Promise<SyncStatus> => {
      const res = await api.get('/sync/status');
      return res.data.data;
    },
    refetchInterval: 60 * 1000,
  });
}

export function useFullSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/sync/full'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

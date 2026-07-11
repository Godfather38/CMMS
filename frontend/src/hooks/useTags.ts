import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Tag } from '../types';

export function useTags(search?: string) {
  return useQuery({
    queryKey: ['tags', search || ''],
    queryFn: async (): Promise<Tag[]> => {
      const res = await api.get('/tags', { params: search ? { search } : {} });
      return res.data.data;
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; tag_type?: string }) => api.post('/tags', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; tag_type?: string | null } }) =>
      api.put(`/tags/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

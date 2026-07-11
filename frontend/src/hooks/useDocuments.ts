import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { DocumentRecord, Pagination } from '../types';

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async (): Promise<{ data: DocumentRecord[]; pagination: Pagination }> => {
      const res = await api.get('/documents');
      return { data: res.data.data, pagination: res.data.pagination };
    },
  });
}

export function useRegisterDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { google_file_id: string; copy_to_folder?: boolean }) =>
      api.post('/documents', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useSyncDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/documents/${id}/sync`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

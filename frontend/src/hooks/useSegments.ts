import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../services/api';
import type { Segment, SegmentAssociation, Pagination } from '../types';

export interface SegmentListParams {
  categoryId?: string;
  tagIds?: string[];
  search?: string;
  documentId?: string;
  sort?: string;
  order?: string;
  limit?: number;
}

interface SegmentPage {
  data: Segment[];
  pagination: Pagination;
}

export function useSegments(params: SegmentListParams) {
  const limit = params.limit || 20;
  return useInfiniteQuery({
    queryKey: ['segments', params],
    queryFn: async ({ pageParam = 0 }): Promise<SegmentPage> => {
      const res = await api.get('/segments', {
        params: {
          category_id: params.categoryId || undefined,
          tag_ids: params.tagIds?.length ? params.tagIds.join(',') : undefined,
          search: params.search || undefined,
          document_id: params.documentId || undefined,
          sort: params.sort || undefined,
          order: params.order || undefined,
          limit,
          offset: pageParam,
        },
      });
      return { data: res.data.data, pagination: res.data.pagination };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const { total, limit: l, offset } = lastPage.pagination;
      const next = Number(offset) + Number(l);
      return next < total ? next : undefined;
    },
  });
}

export function useSegment(id: string | undefined) {
  return useQuery({
    queryKey: ['segment', id],
    queryFn: async (): Promise<Segment> => {
      const res = await api.get(`/segments/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useSegmentAssociations(id: string | undefined) {
  return useQuery({
    queryKey: ['segment', id, 'associations'],
    queryFn: async (): Promise<SegmentAssociation[]> => {
      const res = await api.get(`/segments/${id}/associations`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      document_id: string;
      category_id: string;
      start_offset: number;
      end_offset: number;
      text_content: string;
      title?: string;
      tag_ids?: string[];
      color?: string;
    }) => api.post('/segments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Segment, 'title' | 'category_id' | 'color' | 'is_primary'>> }) =>
      api.put(`/segments/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['segment', id] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateSegmentColor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, color, propagate = true }: { id: string; color: string; propagate?: boolean }) =>
      api.put(`/segments/${id}/color`, { color, propagate }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['segment', id] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

export function useAddSegmentTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ segmentId, tagIds }: { segmentId: string; tagIds: string[] }) =>
      api.post(`/segments/${segmentId}/tags`, { tag_ids: tagIds }),
    onSuccess: (_, { segmentId }) => {
      queryClient.invalidateQueries({ queryKey: ['segment', segmentId] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useRemoveSegmentTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ segmentId, tagId }: { segmentId: string; tagId: string }) =>
      api.delete(`/segments/${segmentId}/tags/${tagId}`),
    onSuccess: (_, { segmentId }) => {
      queryClient.invalidateQueries({ queryKey: ['segment', segmentId] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useDeleteSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteAssociations = false }: { id: string; deleteAssociations?: boolean }) =>
      api.delete(`/segments/${id}`, { params: { delete_associations: deleteAssociations } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

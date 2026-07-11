import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../services/api';
import type { SearchRequest, SearchResponse } from '../types';

export function useSearch(request: SearchRequest, enabled = true) {
  return useQuery({
    queryKey: ['search', request],
    queryFn: async (): Promise<SearchResponse> => {
      const res = await api.post('/search', request);
      return res.data.data;
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

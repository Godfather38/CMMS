export interface SearchFilters {
  category_ids?: string[];
  tag_ids?: string[];
  tag_logic?: 'AND' | 'OR';
  document_ids?: string[];
  date_range?: { start?: string; end?: string };
  is_primary?: boolean;
}

export interface SearchRequestDTO {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  sort?: 'relevance' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}

export interface FacetCount {
  id: string;
  name: string;
  count: number;
}

export interface SearchResultItem {
  segment: {
    id: string;
    title: string | null;
    text_content: string;
    color: string;
    is_primary: boolean;
    word_count: number | null;
    created_at: Date;
    updated_at: Date;
  };
  document: {
    id: string;
    title: string | null;
    google_file_id: string;
  };
  category: {
    id: string;
    name: string;
    icon: string | null;
  };
  tags: { id: string; name: string; tag_type: string | null }[];
  associations_count: number;
  highlight: string;
  rank: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  facets: {
    categories: FacetCount[];
    tags: FacetCount[];
  };
}

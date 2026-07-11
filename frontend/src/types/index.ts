export interface User {
  id: string;
  email: string;
  display_name: string;
  profile_image_url?: string | null;
  watched_folder_id?: string | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  description?: string | null;
  segment_count?: number;
  sort_order?: number;
  is_default?: boolean;
}

export interface Tag {
  id: string;
  name: string;
  tag_type?: string | null;
  usage_count?: number;
}

export interface DocumentRef {
  id: string;
  title: string | null;
  google_file_id: string;
}

export interface DocumentRecord extends DocumentRef {
  google_folder_id?: string | null;
  last_synced_at?: string | null;
  last_modified_at?: string | null;
  is_active?: boolean;
  segment_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Segment {
  id: string;
  document_id: string;
  category_id: string;
  title: string | null;
  text_content: string;
  start_offset: number;
  end_offset: number;
  category: Category;
  document: DocumentRef;
  tags: Tag[];
  color: string;
  is_primary: boolean;
  word_count: number | null;
  associations_count?: number | string;
  created_at: string;
  updated_at: string;
  highlight?: string;
}

export interface SegmentAssociation {
  id: string;
  association_type: 'derivative' | 'callback' | 'reference';
  created_at: string;
  direction: 'incoming' | 'outgoing';
  related_segment_id: string;
  related_segment?: {
    id: string;
    title: string | null;
    text_content: string;
    color: string;
    document_id: string;
  };
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  status: string;
  data: T[];
  pagination: Pagination;
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
    created_at: string;
    updated_at: string;
  };
  document: DocumentRef;
  category: { id: string; name: string; icon: string | null };
  tags: Tag[];
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

export interface SearchRequest {
  query: string;
  filters?: {
    category_ids?: string[];
    tag_ids?: string[];
    tag_logic?: 'AND' | 'OR';
    document_ids?: string[];
    is_primary?: boolean;
  };
  limit?: number;
  offset?: number;
  sort?: 'relevance' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}

export interface SyncStatus {
  last_full_sync: string | null;
  last_document_sync?: { document_id: string; timestamp: string };
  pending_changes: number;
  watched_folder: { id: string | null };
}

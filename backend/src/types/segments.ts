export interface Segment {
  id: string;
  user_id: string;
  document_id: string;
  category_id: string;
  start_offset: number;
  end_offset: number;
  text_content: string;
  title: string | null;
  color: string;
  is_primary: boolean;
  word_count: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SegmentQueryFilters {
  category_id?: string;
  tag_ids?: string[];
  search?: string;
  document_id?: string;
  is_primary?: boolean;
  limit?: number;
  offset?: number;
  sort?: 'created_at' | 'updated_at' | 'title' | 'word_count';
  order?: 'asc' | 'desc';
}

export interface CreateSegmentDTO {
  document_id: string;
  category_id: string;
  start_offset: number;
  end_offset: number;
  text_content: string;
  title?: string;
  tag_ids?: string[];
  color?: string;
}

export interface UpdateSegmentDTO {
  title?: string;
  category_id?: string;
  color?: string;
  is_primary?: boolean;
}

export type AssociationType = 'derivative' | 'callback' | 'reference';

export interface AssociateSegmentDTO {
  target_document_id: string;
  start_offset: number;
  end_offset: number;
  text_content: string;
  association_type: AssociationType;
}

export interface UpdateMarkersDTO {
  start_offset: number;
  end_offset: number;
}

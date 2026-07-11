export interface Tag {
  id: string;
  user_id: string;
  name: string;
  tag_type: string | null;
  created_at: Date;
  usage_count?: number;
}

export interface CreateTagDTO {
  name: string;
  tag_type?: string;
}

export interface BulkCreateTagsDTO {
  names: string[];
  tag_type?: string;
}

export interface UpdateTagDTO {
  name?: string;
  tag_type?: string | null;
}

export interface TagQueryFilters {
  search?: string;
  type?: string;
}

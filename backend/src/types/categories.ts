export interface Category {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
  segment_count?: number;
}

export interface CreateCategoryDTO {
  name: string;
  description?: string;
  icon?: string;
}

export interface UpdateCategoryDTO {
  name?: string;
  description?: string;
  icon?: string;
}

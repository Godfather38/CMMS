export interface Document {
  id: string;
  user_id: string;
  google_file_id: string;
  title: string | null;
  google_folder_id: string | null;
  mime_type: string;
  last_synced_at: Date | null;
  last_modified_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  segment_count?: number;
}

export interface CreateDocumentDTO {
  google_file_id: string;
  copy_to_folder?: boolean;
}

export interface CreateFromSelectionDTO {
  source_google_file_id: string;
  selected_text: string;
  title: string;
}

export interface DocumentQueryFilters {
  search?: string;
  category_id?: string;
  tag_id?: string;
  limit?: number;
  offset?: number;
}

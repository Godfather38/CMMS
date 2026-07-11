export interface SyncConflict {
  segment_id: string;
  type: string;
  details: string;
}

export interface OrphanedSegment {
  id: string;
  title: string | null;
  last_text: string;
}

export interface SyncResult {
  status: 'success' | 'failed' | 'partial';
  updated_segments: number;
  repositioned_segments: number;
  orphaned_segments: OrphanedSegment[];
  conflicts: SyncConflict[];
}

export interface FullSyncResult {
  documents_synced: number;
  documents_added: number;
  documents_removed: number;
  segments_updated: number;
  errors: { document_id: string; error: string }[];
}

export interface SyncStatus {
  last_full_sync: Date | null;
  last_document_sync?: { document_id: string; timestamp: Date };
  pending_changes: number;
  watched_folder: { id: string | null };
}

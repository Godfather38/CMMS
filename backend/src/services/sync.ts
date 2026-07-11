import { db } from '../config/database';
import { SyncResult, FullSyncResult, SyncStatus } from '../types/sync';
import * as googleDocs from './googleDocs';
import * as driveService from './drive';
import * as docService from './documents';
import { getUserById } from './auth';
import { AppError } from '../utils/errors';

export const syncDocument = async (userId: string, documentId: string): Promise<SyncResult> => {
  const client = await db.pool.connect();
  const result: SyncResult = {
    status: 'success',
    updated_segments: 0,
    repositioned_segments: 0,
    orphaned_segments: [],
    conflicts: []
  };

  try {
    // 1. Get DB Document
    const docRes = await client.query(
      'SELECT * FROM documents WHERE id = $1 AND user_id = $2', 
      [documentId, userId]
    );
    if (docRes.rowCount === 0) throw new AppError('Document not found', 404);
    const doc = docRes.rows[0];

    // 2. Fetch from Google
    let driveDoc;
    let fullText = '';
    let namedRanges: Record<string, { start: number; end: number }> = {};

    try {
      driveDoc = await googleDocs.fetchDocument(userId, doc.google_file_id);
      fullText = googleDocs.extractFullText(driveDoc);
      namedRanges = googleDocs.getCmmsNamedRanges(driveDoc);
    } catch (error: any) {
      // Handle File Missing/No Access
      if (error.statusCode === 404 || error.statusCode === 403) {
        await client.query(
          'UPDATE documents SET is_active = false, updated_at = NOW() WHERE id = $1',
          [documentId]
        );
        await logSync(userId, documentId, 'single_sync', 'failed', { error: error.message });
        return { ...result, status: 'failed', conflicts: [{ segment_id: 'all', type: 'document_access_lost', details: error.message }] };
      }
      throw error;
    }

    // 3. Get DB Segments
    const segRes = await client.query(
      'SELECT * FROM segments WHERE document_id = $1',
      [documentId]
    );
    const dbSegments = segRes.rows;

    await client.query('BEGIN');

    // 4. Reconcile
    for (const segment of dbSegments) {
      const range = namedRanges[segment.id];

      if (!range) {
        // ORPHANED: Marker missing in doc
        result.orphaned_segments.push({
          id: segment.id,
          title: segment.title,
          last_text: segment.text_content
        });
        // We do NOT delete immediately; just log conflict/orphan state
        // UI should show visual warning
        result.conflicts.push({ 
          segment_id: segment.id, 
          type: 'marker_missing', 
          details: 'Named range not found in Google Doc' 
        });
        continue;
      }

      // Check Text & Position
      const docText = fullText.substring(range.start, range.end);
      
      const textChanged = docText !== segment.text_content;
      const posChanged = range.start !== segment.start_offset || range.end !== segment.end_offset;

      if (textChanged || posChanged) {
        const updateQuery = `
          UPDATE segments 
          SET start_offset = $1, end_offset = $2, text_content = $3, updated_at = NOW()
          WHERE id = $4
        `;
        await client.query(updateQuery, [range.start, range.end, docText, segment.id]);
        
        if (textChanged) result.updated_segments++;
        if (posChanged && !textChanged) result.repositioned_segments++; // Only count strictly moved if text didn't change (simplification)
      }
    }

    // 5. Update Doc Metadata
    await client.query(
      'UPDATE documents SET last_synced_at = NOW(), title = $1, updated_at = NOW() WHERE id = $2',
      [driveDoc.title, documentId]
    );

    await client.query('COMMIT');
    await logSync(userId, documentId, 'single_sync', 'success', result);

    return result;

  } catch (error: any) {
    await client.query('ROLLBACK');
    await logSync(userId, documentId, 'single_sync', 'failed', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

export const syncAllDocuments = async (userId: string): Promise<FullSyncResult> => {
  const result: FullSyncResult = {
    documents_synced: 0,
    documents_added: 0,
    documents_removed: 0,
    segments_updated: 0,
    errors: []
  };

  // 1. Get Watched Folder + User
  const user = await getUserById(userId);
  if (!user) throw new AppError('User not found', 404);

  const folderId = user.watched_folder_id;
  if (!folderId) {
    throw new AppError('No watched folder configured', 400);
  }

  // 2. List Drive Files
  const driveFiles = await driveService.listFilesInFolder(userId, folderId);

  // 3. Get DB Documents
  const dbDocsRes = await db.query(
    'SELECT id, google_file_id FROM documents WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  const dbDocsMap = new Map(dbDocsRes.rows.map(d => [d.google_file_id, d.id]));

  // 4. Process Drive Files
  for (const file of driveFiles) {
    if (!file.id) continue;
    if (dbDocsMap.has(file.id)) {
      // Exists: Sync it
      try {
        const docId = dbDocsMap.get(file.id);
        const singleRes = await syncDocument(userId, docId!);
        result.documents_synced++;
        result.segments_updated += singleRes.updated_segments;
      } catch (err: any) {
        result.errors.push({ document_id: dbDocsMap.get(file.id)!, error: err.message });
      }
      dbDocsMap.delete(file.id); // Remove from map to identify deletions later
    } else {
      // New File: Auto-register
      try {
        await docService.registerDocument(user, { google_file_id: file.id });
        result.documents_added++;
      } catch (err: any) {
        console.error('Failed to auto-register', err);
      }
    }
  }

  // 5. Handle Deleted Files (Remaining in Map)
  for (const [, docId] of dbDocsMap) {
    await db.query('UPDATE documents SET is_active = false WHERE id = $1', [docId]);
    result.documents_removed++;
  }

  // 6. Update User Timestamp
  // await db.query('UPDATE users SET last_full_sync = NOW() WHERE id = $1', [userId]); 
  // (Assuming column exists or we store in prefs)

  await logSync(userId, null, 'full_sync', 'success', result);

  return result;
};

export const getSyncStatus = async (userId: string): Promise<SyncStatus> => {
  const lastSyncRes = await db.query(
    `SELECT created_at FROM sync_log WHERE user_id = $1 AND action = 'full_sync' ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  
  const lastDocSyncRes = await db.query(
    `SELECT document_id, created_at FROM sync_log WHERE user_id = $1 AND action = 'single_sync' ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  const userRes = await db.query('SELECT watched_folder_id FROM users WHERE id = $1', [userId]);

  return {
    last_full_sync: lastSyncRes.rows[0]?.created_at || null,
    last_document_sync: lastDocSyncRes.rows[0] ? {
      document_id: lastDocSyncRes.rows[0].document_id,
      timestamp: lastDocSyncRes.rows[0].created_at
    } : undefined,
    pending_changes: 0, // Placeholder
    watched_folder: { id: userRes.rows[0]?.watched_folder_id }
  };
};

// --- Helpers ---

const logSync = async (userId: string, docId: string | null, action: string, status: string, details: any) => {
  await db.query(
    `INSERT INTO sync_log (user_id, document_id, action, status, details) VALUES ($1, $2, $3, $4, $5)`,
    [userId, docId, action, status, JSON.stringify(details)]
  );
};
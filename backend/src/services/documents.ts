import { db } from '../config/database';
import { 
  CreateDocumentDTO, 
  CreateFromSelectionDTO, 
  DocumentQueryFilters, 
  Document 
} from '../types/documents';
import { User } from '../types';
import * as driveService from './drive';
import { AppError } from '../utils/errors';

export const listDocuments = async (userId: string, filters: DocumentQueryFilters) => {
  const { limit = 50, offset = 0, search, category_id, tag_id } = filters;
  const params: any[] = [userId, limit, offset];
  let paramIdx = 4;

  let query = `
    SELECT 
      d.*,
      COUNT(s.id)::int as segment_count
    FROM documents d
    LEFT JOIN segments s ON d.id = s.document_id
    WHERE d.user_id = $1 AND d.is_active = true
  `;

  if (search) {
    query += ` AND (d.title ILIKE $${paramIdx} OR d.title ILIKE $${paramIdx})`; // Simplified title search
    params.push(`%${search}%`);
    paramIdx++;
  }

  // Filtering by category/tag implies we only want documents containing those segments
  if (category_id) {
    query += ` AND EXISTS (SELECT 1 FROM segments s2 WHERE s2.document_id = d.id AND s2.category_id = $${paramIdx})`;
    params.push(category_id);
    paramIdx++;
  }

  if (tag_id) {
     query += ` 
       AND EXISTS (
         SELECT 1 FROM segments s3 
         JOIN segment_tags st ON s3.id = st.segment_id
         WHERE s3.document_id = d.id AND st.tag_id = $${paramIdx}
       )
     `;
    params.push(tag_id);
    paramIdx++;
  }

  query += `
    GROUP BY d.id
    ORDER BY d.updated_at DESC
    LIMIT $2 OFFSET $3
  `;

  const { rows } = await db.query(query, params);
  
  // Get total count for pagination metadata (simplified, normally separate count query)
  const countQuery = `SELECT COUNT(*) FROM documents WHERE user_id = $1 AND is_active = true`;
  const countRes = await db.query(countQuery, [userId]);

  return {
    data: rows as Document[],
    total: parseInt(countRes.rows[0].count, 10)
  };
};

export const getDocumentById = async (userId: string, id: string) => {
  const query = `
    SELECT 
      d.*,
      json_agg(s.*) FILTER (WHERE s.id IS NOT NULL) as segments
    FROM documents d
    LEFT JOIN segments s ON d.id = s.document_id
    WHERE d.id = $1 AND d.user_id = $2 AND d.is_active = true
    GROUP BY d.id
  `;
  
  const { rows } = await db.query(query, [id, userId]);
  if (rows.length === 0) return null;
  return rows[0];
};

export const registerDocument = async (user: User, dto: CreateDocumentDTO) => {
  let fileId = dto.google_file_id;

  // 1. Check if already exists (idempotency)
  const existing = await db.query(
    'SELECT * FROM documents WHERE user_id = $1 AND google_file_id = $2',
    [user.id, fileId]
  );
  if (existing.rows.length > 0) {
    // Reactivate if it was soft deleted
    if (!existing.rows[0].is_active) {
       await db.query('UPDATE documents SET is_active = true WHERE id = $1', [existing.rows[0].id]);
       return existing.rows[0];
    }
    return existing.rows[0];
  }

  // 2. Handle Copy if requested
  if (dto.copy_to_folder) {
    if (!user.watched_folder_id) {
      throw new AppError('User has no watched folder configured', 400);
    }
    // Get original metadata to preserve name
    const originalMeta = await driveService.getFileMetadata(user.id, fileId);
    
    // Copy
    const copyRes = await driveService.copyFileToFolder(
      user.id, 
      fileId, 
      user.watched_folder_id, 
      originalMeta.name // Keep original name
    );
    fileId = copyRes.id!;
  }

  // 3. Fetch Metadata (if not copied, we need it; if copied, we have it)
  const meta = await driveService.getFileMetadata(user.id, fileId);

  // 4. Create DB Record
  const insertQuery = `
    INSERT INTO documents 
    (user_id, google_file_id, title, google_folder_id, mime_type, last_modified_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  
  // Extract parent folder (simplified, takes first parent)
  const parentId = meta.parents && meta.parents.length > 0 ? meta.parents[0] : null;

  const { rows } = await db.query(insertQuery, [
    user.id,
    fileId,
    meta.name,
    parentId,
    meta.mimeType,
    meta.modifiedTime
  ]);

  const newDoc = rows[0];

  // 5. Update Drive App Properties (async, non-blocking if needed, but safer to block here)
  await driveService.updateFileProperties(user.id, fileId, {
    cmms_registered: 'true',
    cmms_doc_id: newDoc.id
  });

  return newDoc;
};

export const createDocumentFromSelection = async (user: User, dto: CreateFromSelectionDTO) => {
  if (!user.watched_folder_id) {
    throw new AppError('User has no watched folder configured', 400);
  }

  // 1. Create new Doc in Drive
  const driveDoc = await driveService.createDocument(
    user.id, 
    dto.title, 
    user.watched_folder_id,
    dto.selected_text
  );

  // 2. Register it in DB
  return registerDocument(user, { google_file_id: driveDoc.documentId! });
};

export const deleteDocument = async (userId: string, id: string, hardDelete: boolean) => {
  if (hardDelete) {
    const res = await db.query('DELETE FROM documents WHERE id = $1 AND user_id = $2', [id, userId]);
    return res.rowCount && res.rowCount > 0;
  } else {
    const res = await db.query(
      'UPDATE documents SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2', 
      [id, userId]
    );
    return res.rowCount && res.rowCount > 0;
  }
};
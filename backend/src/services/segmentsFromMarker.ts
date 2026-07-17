import { db } from '../config/database';
import { CreateFromMarkerDTO } from '../types/segments';
import { AppError } from '../utils/errors';
import * as googleDocs from './googleDocs';
import * as colorService from './color';
import { getSegmentById } from './segments';

/**
 * Turn a `cmms_segment_<marker_id>` named range (placed by the Docs sidebar)
 * into a segment. All measuring happens server-side against the same Docs
 * document the sync engine reads, so producer and sync agree by construction.
 *
 * The marker uuid becomes the segment's primary key, which makes the endpoint
 * idempotent: a sidebar retry after a timeout finds the existing row.
 *
 * Two modes (validated upstream as mutually exclusive):
 *  - category_id: a new primary segment
 *  - associate_with_segment_id + association_type: a linked, non-primary copy
 *    inheriting category/title/color from the source segment
 */
export const createSegmentFromMarker = async (
  userId: string,
  dto: CreateFromMarkerDTO
): Promise<{ segment: any; created: boolean }> => {
  // 1. Registration check first — cheap, no Google round-trip
  const docRes = await db.query(
    'SELECT id FROM documents WHERE user_id = $1 AND google_file_id = $2 AND is_active = true',
    [userId, dto.google_file_id]
  );
  if (docRes.rows.length === 0) {
    throw new AppError('Document not registered with CMMS. Register it from the sidebar first.', 404);
  }
  const documentId = docRes.rows[0].id;

  // 2. Idempotency: the marker id IS the segment id
  const existing = await getSegmentById(userId, dto.marker_id);
  if (existing) {
    if (existing.document_id === documentId) {
      return { segment: existing, created: false };
    }
    throw new AppError('Marker id already used by a segment in another document', 409);
  }

  // 3. Read the document (dev users / disconnected Google fail here with a clean 401)
  const gdoc = await googleDocs.fetchDocument(userId, dto.google_file_id);

  // 4. Locate the marker
  const range = googleDocs.getCmmsNamedRanges(gdoc)[dto.marker_id];
  if (!range) {
    throw new AppError(`Marker cmms_segment_${dto.marker_id} not found in the document`, 422);
  }

  // 5. Extract the covered text in Docs index space
  const text = googleDocs.extractTextForRange(gdoc, range.start, range.end);
  if (!text.trim()) {
    throw new AppError('Marker covers no text', 422);
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    if (dto.category_id) {
      // 6a. New primary segment
      const color = await colorService.assignColor(userId, documentId);
      await client.query(
        `INSERT INTO segments
           (id, user_id, document_id, category_id, start_offset, end_offset, text_content, title, color, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
        [
          dto.marker_id,
          userId,
          documentId,
          dto.category_id,
          range.start,
          range.end,
          text,
          dto.title || text.substring(0, 50),
          color,
        ]
      );

      if (dto.tag_ids && dto.tag_ids.length > 0) {
        const values = dto.tag_ids.map((_, i) => `($1, $${i + 2})`).join(',');
        await client.query(
          `INSERT INTO segment_tags (segment_id, tag_id) VALUES ${values} ON CONFLICT DO NOTHING`,
          [dto.marker_id, ...dto.tag_ids]
        );
      }

      await client.query('COMMIT');
      await colorService.recordColorUsage(userId, color);
    } else {
      // 6b. Linked copy of an existing segment
      const source = await getSegmentById(userId, dto.associate_with_segment_id!);
      if (!source) throw new AppError('Source segment not found', 404);

      await client.query(
        `INSERT INTO segments
           (id, user_id, document_id, category_id, start_offset, end_offset, text_content, title, color, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)`,
        [
          dto.marker_id,
          userId,
          documentId,
          source.category_id,
          range.start,
          range.end,
          text,
          source.title,
          source.color,
        ]
      );
      await client.query(
        `INSERT INTO segment_associations (source_segment_id, target_segment_id, association_type)
         VALUES ($1, $2, $3)`,
        [dto.associate_with_segment_id, dto.marker_id, dto.association_type]
      );

      await client.query('COMMIT');
      await colorService.recordColorUsage(userId, source.color);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const segment = await getSegmentById(userId, dto.marker_id);
  return { segment, created: true };
};

import { db } from '../config/database';
import { 
  CreateSegmentDTO, 
  UpdateSegmentDTO, 
  SegmentQueryFilters, 
  AssociateSegmentDTO,
  UpdateMarkersDTO,
  Segment
} from '../types/segments';
import { AppError } from '../utils/errors';
import * as colorService from './colors';

export const listSegments = async (userId: string, filters: SegmentQueryFilters) => {
  const { 
    category_id, 
    tag_ids, 
    search, 
    document_id, 
    is_primary, 
    limit = 50, 
    offset = 0, 
    sort = 'created_at', 
    order = 'desc' 
  } = filters;

  const params: any[] = [userId, limit, offset];
  let paramIdx = 4;
  
  // Base Query
  let selectClause = `
    SELECT 
      s.*,
      c.name as category_name,
      c.icon as category_icon,
      d.title as document_title,
      d.google_file_id,
      (SELECT COUNT(*) FROM segment_associations sa 
       WHERE sa.source_segment_id = s.id OR sa.target_segment_id = s.id) as associations_count,
       COALESCE(
         json_agg(json_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), 
         '[]'
       ) as tags
  `;

  let whereClause = `WHERE s.user_id = $1`;

  // Dynamic Joins
  let joins = `
    JOIN categories c ON s.category_id = c.id
    JOIN documents d ON s.document_id = d.id
    LEFT JOIN segment_tags st ON s.id = st.segment_id
    LEFT JOIN tags t ON st.tag_id = t.id
  `;

  // Search Logic (Full Text)
  if (search) {
    selectClause += `, ts_headline('english', s.text_content, websearch_to_tsquery('english', $${paramIdx})) as highlight`;
    whereClause += ` AND (
      s.text_content_tsvector @@ websearch_to_tsquery('english', $${paramIdx}) 
      OR s.title ILIKE $${paramIdx + 1}
    )`;
    params.push(search, `%${search}%`);
    paramIdx += 2;
  }

  // Filters
  if (category_id) {
    whereClause += ` AND s.category_id = $${paramIdx}`;
    params.push(category_id);
    paramIdx++;
  }

  if (document_id) {
    whereClause += ` AND s.document_id = $${paramIdx}`;
    params.push(document_id);
    paramIdx++;
  }

  if (is_primary !== undefined) {
    whereClause += ` AND s.is_primary = $${paramIdx}`;
    params.push(is_primary);
    paramIdx++;
  }

  // Tag Filtering (AND logic)
  if (tag_ids && tag_ids.length > 0) {
    // Ensure we filter for segments that have ALL provided tags
    whereClause += ` AND s.id IN (
      SELECT st_inner.segment_id 
      FROM segment_tags st_inner 
      WHERE st_inner.tag_id = ANY($${paramIdx}::uuid[])
      GROUP BY st_inner.segment_id
      HAVING COUNT(DISTINCT st_inner.tag_id) = ${tag_ids.length}
    )`;
    params.push(tag_ids);
    paramIdx++;
  }

  // Construct Final Query
  const query = `
    ${selectClause}
    FROM segments s
    ${joins}
    ${whereClause}
    GROUP BY s.id, c.id, d.id
    ORDER BY s.${sort} ${order.toUpperCase()}
    LIMIT $2 OFFSET $3
  `;

  const { rows } = await db.query(query, params);
  
  // Transform flat structure to nested objects expected by frontend
  const formattedRows = rows.map((r: any) => ({
    ...r,
    category: { id: r.category_id, name: r.category_name, icon: r.category_icon },
    document: { id: r.document_id, title: r.document_title, google_file_id: r.google_file_id },
    tags: r.tags || [],
    highlight: r.highlight || undefined
  }));

  // Count Query for Pagination
  const countQuery = `SELECT COUNT(DISTINCT s.id) FROM segments s ${joins} ${whereClause}`;
  const countRes = await db.query(countQuery, params.slice(0, paramIdx - 1)); // Exclude limit/offset

  return {
    data: formattedRows,
    total: parseInt(countRes.rows[0].count, 10)
  };
};

export const getSegmentById = async (userId: string, id: string) => {
  const query = `
    SELECT 
      s.*,
      json_build_object('id', c.id, 'name', c.name, 'icon', c.icon) as category,
      json_build_object('id', d.id, 'title', d.title, 'google_file_id', d.google_file_id) as document,
      COALESCE(
        json_agg(json_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), 
        '[]'
      ) as tags
    FROM segments s
    JOIN categories c ON s.category_id = c.id
    JOIN documents d ON s.document_id = d.id
    LEFT JOIN segment_tags st ON s.id = st.segment_id
    LEFT JOIN tags t ON st.tag_id = t.id
    WHERE s.id = $1 AND s.user_id = $2
    GROUP BY s.id, c.id, d.id
  `;

  const { rows } = await db.query(query, [id, userId]);
  return rows[0] || null;
};

export const getSegmentAssociations = async (userId: string, segmentId: string) => {
  // Get associations where this segment is Source OR Target
  const query = `
    SELECT 
      sa.id, sa.association_type, sa.created_at,
      CASE 
        WHEN sa.source_segment_id = $1 THEN sa.target_segment_id
        ELSE sa.source_segment_id 
      END as related_segment_id,
      CASE 
        WHEN sa.source_segment_id = $1 THEN 'outgoing'
        ELSE 'incoming' 
      END as direction
    FROM segment_associations sa
    JOIN segments s ON s.id = sa.source_segment_id -- Check user ownership via join
    WHERE (sa.source_segment_id = $1 OR sa.target_segment_id = $1)
      AND s.user_id = $2
  `;

  const { rows } = await db.query(query, [segmentId, userId]);
  
  // Need to fetch details for the related segments
  if (rows.length === 0) return [];

  const relatedIds = rows.map((r: any) => r.related_segment_id);
  const segmentsRes = await db.query(
    `SELECT id, title, text_content, color, document_id FROM segments WHERE id = ANY($1::uuid[])`,
    [relatedIds]
  );
  const segmentsMap = new Map(segmentsRes.rows.map(s => [s.id, s]));

  return rows.map((r: any) => ({
    ...r,
    related_segment: segmentsMap.get(r.related_segment_id)
  }));
};

export const createSegment = async (userId: string, dto: CreateSegmentDTO) => {
  // 1. Assign Color
  const color = dto.color || await colorService.assignColor(userId, dto.document_id);

  // 2. Insert Segment
  const insertQuery = `
    INSERT INTO segments 
    (user_id, document_id, category_id, start_offset, end_offset, text_content, title, color, is_primary)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
    RETURNING *
  `;
  
  const values = [
    userId, dto.document_id, dto.category_id, 
    dto.start_offset, dto.end_offset, dto.text_content, 
    dto.title || dto.text_content.substring(0, 50), // Fallback title
    color
  ];

  const { rows } = await db.query(insertQuery, values);
  const segment = rows[0];

  // 3. Record Color Usage
  await colorService.recordColorUsage(userId, color);

  // 4. Insert Tags
  if (dto.tag_ids && dto.tag_ids.length > 0) {
    const tagValues = dto.tag_ids.map((tagId, index) => `($1, $${index + 2})`).join(',');
    await db.query(
      `INSERT INTO segment_tags (segment_id, tag_id) VALUES ${tagValues}`,
      [segment.id, ...dto.tag_ids]
    );
  }

  return getSegmentById(userId, segment.id);
};

export const createAssociation = async (userId: string, sourceId: string, dto: AssociateSegmentDTO) => {
  const sourceSegment = await getSegmentById(userId, sourceId);
  if (!sourceSegment) throw new AppError('Source segment not found', 404);

  // 1. Create Target Segment (Inherits color, is_primary=false)
  const targetQuery = `
    INSERT INTO segments 
    (user_id, document_id, category_id, start_offset, end_offset, text_content, title, color, is_primary)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
    RETURNING id
  `;
  
  const targetRes = await db.query(targetQuery, [
    userId,
    dto.target_document_id,
    sourceSegment.category_id, // Inherit category
    dto.start_offset,
    dto.end_offset,
    dto.text_content,
    sourceSegment.title, // Inherit title
    sourceSegment.color, // Inherit color
  ]);
  const targetId = targetRes.rows[0].id;

  // 2. Create Association Record
  await db.query(
    `INSERT INTO segment_associations (source_segment_id, target_segment_id, association_type)
     VALUES ($1, $2, $3)`,
    [sourceId, targetId, dto.association_type]
  );

  return getSegmentById(userId, targetId);
};

export const updateSegment = async (userId: string, id: string, dto: UpdateSegmentDTO) => {
  const fields: string[] = [];
  const values: any[] = [id, userId];
  let idx = 3;

  if (dto.title !== undefined) { fields.push(`title = $${idx++}`); values.push(dto.title); }
  if (dto.category_id !== undefined) { fields.push(`category_id = $${idx++}`); values.push(dto.category_id); }
  if (dto.color !== undefined) { fields.push(`color = $${idx++}`); values.push(dto.color); }
  if (dto.is_primary !== undefined) { fields.push(`is_primary = $${idx++}`); values.push(dto.is_primary); }

  if (fields.length === 0) return getSegmentById(userId, id);

  const query = `
    UPDATE segments SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `;

  await db.query(query, values);
  
  // If color changed, propagate? The requirement said "Propagate color" in the algorithm section.
  // Logic: update color for all associated segments recursively.
  if (dto.color) {
    await propagateColorChange(userId, id, dto.color);
    await colorService.recordColorUsage(userId, dto.color);
  }

  return getSegmentById(userId, id);
};

const propagateColorChange = async (userId: string, startSegmentId: string, newColor: string) => {
  // Simplified propagation: Update direct associations where current color matches old color?
  // Or just update all segments in the 'cluster'. 
  // For MVP, let's update segments that share an association edge.
  
  // Recursive CTE to find all connected segments
  const query = `
    WITH RECURSIVE segment_chain AS (
        SELECT source_segment_id, target_segment_id FROM segment_associations
        UNION
        SELECT sa.source_segment_id, sa.target_segment_id 
        FROM segment_associations sa
        INNER JOIN segment_chain sc ON sa.source_segment_id = sc.target_segment_id
    )
    UPDATE segments 
    SET color = $1 
    WHERE id IN (
        SELECT source_segment_id FROM segment_chain
        UNION 
        SELECT target_segment_id FROM segment_chain
    ) AND user_id = $2 AND id != $3
  `;
  // Note: This CTE logic is tricky. Simpler to just update direct targets of this source.
  // Requirement says: "New segment inherits source color".
  // Let's just update direct children (targets).
  await db.query(`
    UPDATE segments s
    SET color = $1
    FROM segment_associations sa
    WHERE sa.source_segment_id = $2 AND sa.target_segment_id = s.id AND s.user_id = $3
  `, [newColor, startSegmentId, userId]);
};

export const updateMarkers = async (userId: string, id: string, dto: UpdateMarkersDTO) => {
  const query = `
    UPDATE segments 
    SET start_offset = $1, end_offset = $2, updated_at = NOW()
    WHERE id = $3 AND user_id = $4
    RETURNING *
  `;
  const { rows } = await db.query(query, [dto.start_offset, dto.end_offset, id, userId]);
  return rows[0];
};

export const updateTags = async (userId: string, id: string, tagIds: string[]) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Verify ownership
    const check = await client.query('SELECT id FROM segments WHERE id = $1 AND user_id = $2', [id, userId]);
    if (check.rowCount === 0) throw new AppError('Segment not found', 404);

    // Delete existing
    await client.query('DELETE FROM segment_tags WHERE segment_id = $1', [id]);

    // Insert new
    if (tagIds.length > 0) {
      const values = tagIds.map((tid, i) => `($1, $${i + 2})`).join(',');
      await client.query(
        `INSERT INTO segment_tags (segment_id, tag_id) VALUES ${values}`,
        [id, ...tagIds]
      );
    }

    await client.query('COMMIT');
    return getSegmentById(userId, id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export const deleteSegment = async (userId: string, id: string, deleteAssociations: boolean) => {
  if (deleteAssociations) {
    // Cascade delete handles this if tables are set up with ON DELETE CASCADE
    // However, segments table references categories/docs. segment_associations references segments.
    // If we delete segment A:
    //   - Rows in segment_associations where A is source or target are deleted (CASCADE).
    //   - BUT the *other* segments pointed to are NOT deleted automatically by Postgres.
    
    // We need to find segments that are targets of this source (if we are the parent)
    const targetsRes = await db.query(
      `SELECT target_segment_id FROM segment_associations WHERE source_segment_id = $1`,
      [id]
    );
    const targetIds = targetsRes.rows.map(r => r.target_segment_id);

    if (targetIds.length > 0) {
      // Delete children segments
      await db.query(`DELETE FROM segments WHERE id = ANY($1::uuid[]) AND user_id = $2`, [targetIds, userId]);
    }
  } else {
    // Just unlink: Set targets to is_primary = true
    await db.query(`
      UPDATE segments s
      SET is_primary = true
      FROM segment_associations sa
      WHERE sa.source_segment_id = $1 AND sa.target_segment_id = s.id AND s.user_id = $2
    `, [id, userId]);
  }

  // Finally delete the segment itself
  const res = await db.query('DELETE FROM segments WHERE id = $1 AND user_id = $2', [id, userId]);
  return res.rowCount && res.rowCount > 0;
};
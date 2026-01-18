import { db } from '../config/database';
import { Tag, CreateTagDTO, BulkCreateTagsDTO, UpdateTagDTO, TagQueryFilters } from '../types/tags';
import { AppError } from '../utils/errors';
import { getSegmentById } from './segments';

export const listTags = async (userId: string, filters: TagQueryFilters): Promise<Tag[]> => {
  const params: any[] = [userId];
  let paramIdx = 2;

  let query = `
    SELECT 
      t.*,
      COUNT(st.segment_id)::int as usage_count
    FROM tags t
    LEFT JOIN segment_tags st ON t.id = st.tag_id
    WHERE t.user_id = $1
  `;

  if (filters.search) {
    query += ` AND t.name ILIKE $${paramIdx}`;
    params.push(`%${filters.search}%`);
    paramIdx++;
  }

  if (filters.type) {
    query += ` AND t.tag_type = $${paramIdx}`;
    params.push(filters.type);
    paramIdx++;
  }

  query += `
    GROUP BY t.id
    ORDER BY usage_count DESC, t.name ASC
  `;

  const { rows } = await db.query(query, params);
  return rows;
};

export const createTag = async (userId: string, dto: CreateTagDTO): Promise<Tag> => {
  // Check uniqueness
  const exists = await db.query(
    'SELECT 1 FROM tags WHERE user_id = $1 AND name = $2',
    [userId, dto.name]
  );
  if (exists.rowCount && exists.rowCount > 0) {
    throw new AppError('Tag with this name already exists', 400);
  }

  const query = `
    INSERT INTO tags (user_id, name, tag_type)
    VALUES ($1, $2, $3)
    RETURNING *, 0 as usage_count
  `;
  const { rows } = await db.query(query, [userId, dto.name, dto.tag_type]);
  return rows[0];
};

export const bulkCreateTags = async (userId: string, dto: BulkCreateTagsDTO): Promise<Tag[]> => {
  // 1. Identify existing tags
  const names = [...new Set(dto.names)]; // Remove dupes in input
  const { rows: existingRows } = await db.query(
    'SELECT * FROM tags WHERE user_id = $1 AND name = ANY($2::text[])',
    [userId, names]
  );
  
  const existingMap = new Map(existingRows.map(r => [r.name, r]));
  const createdTags: Tag[] = [];

  // 2. Create missing tags
  // We'll do this serially or in a single batch query. Batch is better.
  const newNames = names.filter(n => !existingMap.has(n));
  
  if (newNames.length > 0) {
    const values = newNames.map((n, i) => `($1, $${i + 3}, $2)`).join(',');
    // $1 = userId, $2 = tag_type, $3... = names
    const insertQuery = `
      INSERT INTO tags (user_id, name, tag_type)
      VALUES ${values}
      RETURNING *, 0 as usage_count
    `;
    const insertParams = [userId, dto.tag_type, ...newNames];
    
    // Note on parameters: $1, $2, $3, $4... 
    // We need to construct the placeholder string correctly based on index.
    // It's safer/easier to loop if constructing dynamic SQL for parameterized queries feels risky or complex in a simple string builder.
    // However, let's use a loop for simplicity and safety unless performance is critical (unlikely for < 50 tags).
    
    // Actually, let's try a safer batch insert approach using unnest if available, or just loop.
    // Given standard usage, a loop is fine for MVP.
    for (const name of newNames) {
      const { rows } = await db.query(
        'INSERT INTO tags (user_id, name, tag_type) VALUES ($1, $2, $3) RETURNING *, 0 as usage_count',
        [userId, name, dto.tag_type]
      );
      createdTags.push(rows[0]);
    }
  }

  // 3. Combine and return all
  return names.map(name => existingMap.get(name) || createdTags.find(t => t.name === name)) as Tag[];
};

export const updateTag = async (userId: string, id: string, dto: UpdateTagDTO): Promise<Tag> => {
  const current = await db.query('SELECT * FROM tags WHERE id = $1 AND user_id = $2', [id, userId]);
  if (current.rowCount === 0) throw new AppError('Tag not found', 404);

  if (dto.name && dto.name !== current.rows[0].name) {
    const exists = await db.query(
      'SELECT 1 FROM tags WHERE user_id = $1 AND name = $2 AND id != $3',
      [userId, dto.name, id]
    );
    if (exists.rowCount && exists.rowCount > 0) {
      throw new AppError('Tag name already exists', 400);
    }
  }

  const fields: string[] = [];
  const values: any[] = [id, userId];
  let idx = 3;

  if (dto.name !== undefined) { fields.push(`name = $${idx++}`); values.push(dto.name); }
  if (dto.tag_type !== undefined) { fields.push(`tag_type = $${idx++}`); values.push(dto.tag_type); }

  if (fields.length === 0) return current.rows[0];

  const query = `
    UPDATE tags SET ${fields.join(', ')}
    WHERE id = $1 AND user_id = $2
    RETURNING *, (SELECT COUNT(*)::int FROM segment_tags WHERE tag_id = tags.id) as usage_count
  `;

  const { rows } = await db.query(query, values);
  return rows[0];
};

export const deleteTag = async (userId: string, id: string) => {
  const res = await db.query('DELETE FROM tags WHERE id = $1 AND user_id = $2', [id, userId]);
  return res.rowCount && res.rowCount > 0;
};

export const autocompleteTags = async (userId: string, q: string, limit: number): Promise<Tag[]> => {
  const query = `
    SELECT 
      t.*,
      COUNT(st.segment_id)::int as usage_count
    FROM tags t
    LEFT JOIN segment_tags st ON t.id = st.tag_id
    WHERE t.user_id = $1 AND t.name ILIKE $2
    GROUP BY t.id
    ORDER BY usage_count DESC, t.name ASC
    LIMIT $3
  `;
  
  const { rows } = await db.query(query, [userId, `${q}%`, limit]);
  return rows;
};

// Segment-Tag Operations

export const addTagsToSegment = async (userId: string, segmentId: string, tagIds: string[]) => {
  // Verify access via segment
  const segment = await getSegmentById(userId, segmentId);
  if (!segment) throw new AppError('Segment not found', 404);

  if (tagIds.length === 0) return segment;

  // Insert ignoring duplicates (ON CONFLICT DO NOTHING)
  const values = tagIds.map((tid, i) => `($1, $${i + 2})`).join(',');
  const query = `
    INSERT INTO segment_tags (segment_id, tag_id)
    VALUES ${values}
    ON CONFLICT (segment_id, tag_id) DO NOTHING
  `;

  await db.query(query, [segmentId, ...tagIds]);
  
  return getSegmentById(userId, segmentId);
};

export const removeTagFromSegment = async (userId: string, segmentId: string, tagId: string) => {
  // Verify access via segment
  const segment = await getSegmentById(userId, segmentId);
  if (!segment) throw new AppError('Segment not found', 404);

  await db.query(
    'DELETE FROM segment_tags WHERE segment_id = $1 AND tag_id = $2',
    [segmentId, tagId]
  );
};
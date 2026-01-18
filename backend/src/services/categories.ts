import { db } from '../config/database';
import { Category, CreateCategoryDTO, UpdateCategoryDTO } from '../types/categories';
import { AppError } from '../utils/errors';

// Default categories to seed for new users
const DEFAULT_CATEGORIES = [
  { name: 'One-Liner', icon: '💬', description: 'Short, self-contained joke' },
  { name: 'Bit', icon: '🎭', description: 'A distinct chunk of material on a specific topic' },
  { name: 'Set', icon: '📋', description: 'A collection of bits arranged for performance' },
  { name: 'Sketch', icon: '🎬', description: 'Scripted scene for multiple characters' },
  { name: 'Premise', icon: '💡', description: 'An idea or concept not yet fully fleshed out' },
  { name: 'Callback', icon: '🔄', description: 'A reference to an earlier joke' },
  { name: 'Crowd Work', icon: '👥', description: 'Interactions with the audience' },
  { name: 'Opener', icon: '🚀', description: 'Material used to start a set' },
  { name: 'Closer', icon: '🎯', description: 'Strong material used to end a set' }
];

export const seedDefaultCategories = async (userId: string) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if user already has categories to prevent double seeding
    const check = await client.query('SELECT 1 FROM categories WHERE user_id = $1 LIMIT 1', [userId]);
    if (check.rowCount > 0) {
      await client.query('ROLLBACK');
      return;
    }

    // Insert defaults
    const values = DEFAULT_CATEGORIES.map((cat, index) => {
      // ($1, $2, $3, $4, $5, $6)
      return `('${userId}', '${cat.name}', '${cat.description}', '${cat.icon}', ${(index + 1) * 10}, true)`;
    }).join(',');

    const query = `
      INSERT INTO categories (user_id, name, description, icon, sort_order, is_default)
      VALUES ${values}
    `;
    
    await client.query(query);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const listCategories = async (userId: string): Promise<Category[]> => {
  const query = `
    SELECT 
      c.*,
      COUNT(s.id)::int as segment_count
    FROM categories c
    LEFT JOIN segments s ON c.id = s.category_id
    WHERE c.user_id = $1
    GROUP BY c.id
    ORDER BY c.sort_order ASC
  `;
  const { rows } = await db.query(query, [userId]);
  return rows;
};

export const createCategory = async (userId: string, dto: CreateCategoryDTO): Promise<Category> => {
  // 1. Check uniqueness
  const exists = await db.query(
    'SELECT 1 FROM categories WHERE user_id = $1 AND name = $2', 
    [userId, dto.name]
  );
  if (exists.rowCount && exists.rowCount > 0) {
    throw new AppError('Category name must be unique', 400);
  }

  // 2. Get next sort order
  const sortRes = await db.query(
    'SELECT MAX(sort_order) as max_sort FROM categories WHERE user_id = $1',
    [userId]
  );
  const nextSortOrder = (sortRes.rows[0].max_sort || 0) + 10;

  // 3. Insert
  const query = `
    INSERT INTO categories (user_id, name, description, icon, sort_order, is_default)
    VALUES ($1, $2, $3, $4, $5, false)
    RETURNING *
  `;
  const { rows } = await db.query(query, [
    userId, dto.name, dto.description, dto.icon, nextSortOrder
  ]);
  
  return { ...rows[0], segment_count: 0 };
};

export const updateCategory = async (userId: string, id: string, dto: UpdateCategoryDTO): Promise<Category> => {
  // Check existence
  const current = await db.query('SELECT * FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
  if (current.rowCount === 0) throw new AppError('Category not found', 404);

  // Check uniqueness if name changed
  if (dto.name && dto.name !== current.rows[0].name) {
    const exists = await db.query(
      'SELECT 1 FROM categories WHERE user_id = $1 AND name = $2 AND id != $3', 
      [userId, dto.name, id]
    );
    if (exists.rowCount && exists.rowCount > 0) {
      throw new AppError('Category name must be unique', 400);
    }
  }

  const fields: string[] = [];
  const values: any[] = [id, userId];
  let idx = 3;

  if (dto.name !== undefined) { fields.push(`name = $${idx++}`); values.push(dto.name); }
  if (dto.description !== undefined) { fields.push(`description = $${idx++}`); values.push(dto.description); }
  if (dto.icon !== undefined) { fields.push(`icon = $${idx++}`); values.push(dto.icon); }

  if (fields.length === 0) return current.rows[0];

  const query = `
    UPDATE categories SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `;
  
  const { rows } = await db.query(query, values);
  return rows[0];
};

export const reorderCategories = async (userId: string, categoryIds: string[]) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verify all IDs belong to user
    const verifyRes = await client.query(
      'SELECT id FROM categories WHERE user_id = $1 AND id = ANY($2::uuid[])',
      [userId, categoryIds]
    );
    if (verifyRes.rowCount !== categoryIds.length) {
      throw new AppError('One or more categories not found or do not belong to user', 400);
    }

    // Update sort_order for each
    for (let i = 0; i < categoryIds.length; i++) {
      await client.query(
        'UPDATE categories SET sort_order = $1 WHERE id = $2 AND user_id = $3',
        [(i + 1) * 10, categoryIds[i], userId]
      );
    }

    await client.query('COMMIT');
    return listCategories(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const deleteCategory = async (userId: string, id: string, migrateToId?: string) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check existence and segment count
    const catRes = await client.query(`
      SELECT c.id, COUNT(s.id)::int as segment_count
      FROM categories c
      LEFT JOIN segments s ON c.id = s.category_id
      WHERE c.id = $1 AND c.user_id = $2
      GROUP BY c.id
    `, [id, userId]);

    if (catRes.rowCount === 0) throw new AppError('Category not found', 404);
    
    const segmentCount = catRes.rows[0].segment_count;

    // 2. Handle Migration Logic
    if (segmentCount > 0) {
      if (!migrateToId) {
        throw new AppError(`Cannot delete category with ${segmentCount} segments. Provide 'migrate_to' query parameter.`, 400);
      }

      // Verify target category
      const targetRes = await client.query(
        'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
        [migrateToId, userId]
      );
      if (targetRes.rowCount === 0) {
        throw new AppError('Target category for migration not found', 400);
      }

      if (id === migrateToId) {
        throw new AppError('Cannot migrate to the same category being deleted', 400);
      }

      // Migrate segments
      await client.query(
        'UPDATE segments SET category_id = $1, updated_at = NOW() WHERE category_id = $2',
        [migrateToId, id]
      );
    }

    // 3. Delete Category
    await client.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
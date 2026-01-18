import { db } from '../config/database';

const DEFAULT_PALETTE = [
  '#E57373', '#81C784', '#64B5F6', '#FFD54F', '#BA68C8',
  '#4DB6AC', '#FF8A65', '#A1887F', '#90A4AE', '#F06292'
];

export const assignColor = async (userId: string, documentId: string): Promise<string> => {
  // 1. Get User Palette
  const prefRes = await db.query(
    'SELECT color_palette FROM user_preferences WHERE user_id = $1',
    [userId]
  );
  
  let palette: string[] = DEFAULT_PALETTE;
  if (prefRes.rows.length > 0 && prefRes.rows[0].color_palette) {
    // Handle JSONB parsing if pg doesn't auto-parse
    const p = prefRes.rows[0].color_palette;
    palette = Array.isArray(p) ? p : DEFAULT_PALETTE;
  }

  // 2. Get Colors Used in Current Document
  const docColorsRes = await db.query(
    'SELECT DISTINCT color FROM segments WHERE document_id = $1 AND user_id = $2',
    [documentId, userId]
  );
  const usedInDoc = new Set(docColorsRes.rows.map(r => r.color));

  // 3. Find Available Colors (Palette - UsedInDoc)
  const available = palette.filter(c => !usedInDoc.has(c));

  // 4. Get Global Usage Stats for sorting
  const usageRes = await db.query(
    'SELECT color, last_used_at, usage_count FROM color_usage WHERE user_id = $1',
    [userId]
  );
  
  const usageMap = new Map<string, { lastUsed: Date, count: number }>();
  usageRes.rows.forEach(r => {
    usageMap.set(r.color, { lastUsed: r.last_used_at, count: r.usage_count });
  });

  let selectedColor: string;

  if (available.length > 0) {
    // STRATEGY 1: Pick Least Recently Used among available
    selectedColor = available.sort((a, b) => {
      const statsA = usageMap.get(a);
      const statsB = usageMap.get(b);
      // If never used, treat as very old date (0)
      const timeA = statsA ? statsA.lastUsed.getTime() : 0;
      const timeB = statsB ? statsB.lastUsed.getTime() : 0;
      return timeA - timeB; // Ascending (oldest first)
    })[0];
  } else {
    // STRATEGY 2: All palette colors used in doc. Pick Least Used Globally.
    selectedColor = palette.sort((a, b) => {
      const countA = usageMap.get(a)?.count || 0;
      const countB = usageMap.get(b)?.count || 0;
      return countA - countB; // Ascending (lowest count first)
    })[0];
  }

  return selectedColor;
};

export const recordColorUsage = async (userId: string, color: string) => {
  const query = `
    INSERT INTO color_usage (user_id, color, last_used_at, usage_count)
    VALUES ($1, $2, NOW(), 1)
    ON CONFLICT (user_id, color)
    DO UPDATE SET 
      last_used_at = NOW(),
      usage_count = color_usage.usage_count + 1
  `;
  await db.query(query, [userId, color]);
};
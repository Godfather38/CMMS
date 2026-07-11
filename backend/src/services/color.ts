import { db } from '../config/database';

export const DEFAULT_PALETTE = [
  '#E57373', '#81C784', '#64B5F6', '#FFD54F', '#BA68C8',
  '#4DB6AC', '#FF8A65', '#A1887F', '#90A4AE', '#F06292'
];

export interface ColorUsageStats {
  lastUsed: Date;
  count: number;
}

/**
 * Pure selection logic:
 * 1. Prefer palette colors unused in this document, least-recently-used first
 *    (never-used counts as oldest).
 * 2. If the whole palette is used in the document, pick the globally
 *    least-used color.
 */
export const pickColor = (
  palette: string[],
  usedInDoc: Set<string>,
  usageMap: Map<string, ColorUsageStats>
): string => {
  const available = palette.filter(c => !usedInDoc.has(c));

  if (available.length > 0) {
    return [...available].sort((a, b) => {
      const timeA = usageMap.get(a)?.lastUsed.getTime() ?? 0;
      const timeB = usageMap.get(b)?.lastUsed.getTime() ?? 0;
      return timeA - timeB;
    })[0];
  }

  return [...palette].sort((a, b) => {
    const countA = usageMap.get(a)?.count ?? 0;
    const countB = usageMap.get(b)?.count ?? 0;
    return countA - countB;
  })[0];
};

export const assignColor = async (userId: string, documentId: string): Promise<string> => {
  // 1. Get User Palette
  const prefRes = await db.query(
    'SELECT color_palette FROM user_preferences WHERE user_id = $1',
    [userId]
  );

  let palette: string[] = DEFAULT_PALETTE;
  if (prefRes.rows.length > 0 && prefRes.rows[0].color_palette) {
    const p = prefRes.rows[0].color_palette;
    palette = Array.isArray(p) && p.length > 0 ? p : DEFAULT_PALETTE;
  }

  // 2. Get Colors Used in Current Document
  const docColorsRes = await db.query(
    'SELECT DISTINCT color FROM segments WHERE document_id = $1 AND user_id = $2',
    [documentId, userId]
  );
  const usedInDoc = new Set<string>(docColorsRes.rows.map(r => r.color));

  // 3. Get Global Usage Stats
  const usageRes = await db.query(
    'SELECT color, last_used_at, usage_count FROM color_usage WHERE user_id = $1',
    [userId]
  );

  const usageMap = new Map<string, ColorUsageStats>();
  usageRes.rows.forEach(r => {
    usageMap.set(r.color, { lastUsed: r.last_used_at, count: r.usage_count });
  });

  return pickColor(palette, usedInDoc, usageMap);
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

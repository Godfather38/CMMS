import fs from 'fs';
import path from 'path';
import { db } from './database';

/**
 * Apply schema.sql automatically when the database is empty, so a fresh
 * deploy (Render + Neon, Docker, local) needs no manual migration step.
 *
 * Gated on the existence of the `users` table and wrapped in an advisory
 * lock so concurrent boots can't race each other.
 */
export const ensureSchema = async (): Promise<void> => {
  const { rows } = await db.query("SELECT to_regclass('public.users') AS users_table");
  if (rows[0].users_table) return; // schema already applied

  const schemaPath = path.resolve(process.cwd(), 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      `Database is empty and schema.sql was not found at ${schemaPath}. ` +
        'Apply backend/schema.sql manually or start the server from the backend directory.'
    );
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const client = await db.pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    // Re-check under the lock — another instance may have won the race
    const again = await client.query("SELECT to_regclass('public.users') AS users_table");
    if (!again.rows[0].users_table) {
      console.log('🗄️  Empty database detected — applying schema.sql...');
      await client.query(schemaSql);
      console.log('🗄️  Schema applied.');
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
    client.release();
  }
};

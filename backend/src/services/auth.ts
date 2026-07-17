import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { env } from '../config/env';
import { User, TokenPayload } from '../types';
import { getGoogleTokens, getGoogleUserInfo } from '../config/google';
import { saveGoogleTokens } from './googleAuth';
import { UnauthorizedError } from '../utils/errors';

export const getUserById = async (id: string): Promise<User | null> => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
};

export const signToken = (user: User): string => {
  const payload: TokenPayload = { userId: user.id, email: user.email };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

// Long-lived token pasted once into the Google Docs sidebar. Stateless like
// every other JWT here: cannot be revoked before expiry (documented trade-off).
export const ADDON_TOKEN_TTL = '90d';

export const signAddonToken = (user: User): string => {
  const payload: TokenPayload = { userId: user.id, email: user.email, scope: 'addon' };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ADDON_TOKEN_TTL,
  } as jwt.SignOptions);
};

const upsertUser = async (profile: {
  google_id: string;
  email: string;
  display_name?: string | null;
  profile_image_url?: string | null;
}): Promise<{ user: User; isNew: boolean }> => {
  // xmax = 0 only for freshly inserted rows, so it doubles as an is-new flag
  const { rows } = await db.query(
    `INSERT INTO users (google_id, email, display_name, profile_image_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = COALESCE(EXCLUDED.display_name, users.display_name),
       profile_image_url = COALESCE(EXCLUDED.profile_image_url, users.profile_image_url),
       updated_at = NOW()
     RETURNING *, (xmax = 0) AS is_new`,
    [profile.google_id, profile.email, profile.display_name || null, profile.profile_image_url || null]
  );
  const { is_new, ...user } = rows[0];
  return { user: user as User, isNew: is_new };
};

const seedNewUser = async (userId: string): Promise<void> => {
  await db.query('SELECT seed_default_categories($1)', [userId]);
  await db.query(
    'INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  );
};

export const authenticateGoogleUser = async (
  code: string
): Promise<{ user: User; token: string }> => {
  const tokens = await getGoogleTokens(code);
  if (!tokens.access_token) {
    throw new UnauthorizedError('Google did not return an access token');
  }

  const profile = await getGoogleUserInfo(tokens.access_token);
  if (!profile.id || !profile.email) {
    throw new UnauthorizedError('Could not retrieve Google profile');
  }

  const { user, isNew } = await upsertUser({
    google_id: profile.id,
    email: profile.email,
    display_name: profile.name,
    profile_image_url: profile.picture,
  });

  if (isNew) {
    await seedNewUser(user.id);
  }

  await saveGoogleTokens(user.id, tokens);

  return { user, token: signToken(user) };
};

/**
 * Development-only login: creates a local user with seeded categories and a
 * stub document so the whole stack is exercisable without Google credentials.
 * No user_google_tokens row exists for this user, so Drive/Docs endpoints
 * fail with a clean 401 instead of crashing.
 */
export const authenticateDevUser = async (): Promise<{ user: User; token: string }> => {
  const { user, isNew } = await upsertUser({
    google_id: 'dev-user-000',
    email: 'dev@cmms.local',
    display_name: 'Dev User',
  });

  if (isNew) {
    await seedNewUser(user.id);
    await db.query(
      `INSERT INTO documents (user_id, google_file_id, title)
       VALUES ($1, 'dev-file-1', 'Dev Notebook')
       ON CONFLICT (user_id, google_file_id) DO NOTHING`,
      [user.id]
    );
  }

  return { user, token: signToken(user) };
};

export const updateMe = async (
  userId: string,
  updates: { display_name?: string; watched_folder_id?: string | null }
): Promise<User> => {
  const fields: string[] = [];
  const values: any[] = [userId];
  let idx = 2;

  if (updates.display_name !== undefined) {
    fields.push(`display_name = $${idx++}`);
    values.push(updates.display_name);
  }
  if (updates.watched_folder_id !== undefined) {
    fields.push(`watched_folder_id = $${idx++}`);
    values.push(updates.watched_folder_id);
  }

  if (fields.length === 0) {
    const user = await getUserById(userId);
    if (!user) throw new UnauthorizedError('User no longer exists');
    return user;
  }

  const { rows } = await db.query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values
  );
  return rows[0];
};

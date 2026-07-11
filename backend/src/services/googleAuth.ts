import { google } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { db } from '../config/database';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

/**
 * Persist a user's Google OAuth credentials.
 * Google only returns refresh_token on the first consent, so COALESCE
 * keeps the stored one when a re-auth omits it.
 */
export const saveGoogleTokens = async (userId: string, tokens: Credentials): Promise<void> => {
  await db.query(
    `INSERT INTO user_google_tokens (user_id, access_token, refresh_token, scope, token_type, expiry_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, user_google_tokens.refresh_token),
       scope = COALESCE(EXCLUDED.scope, user_google_tokens.scope),
       token_type = COALESCE(EXCLUDED.token_type, user_google_tokens.token_type),
       expiry_date = EXCLUDED.expiry_date,
       updated_at = NOW()`,
    [
      userId,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.scope || null,
      tokens.token_type || null,
      tokens.expiry_date || null,
    ]
  );
};

/**
 * Build an authenticated OAuth2 client for a specific user.
 * A fresh client per call — the shared singleton in config/google.ts must
 * never carry per-user credentials. googleapis auto-refreshes when a
 * refresh_token is set; the 'tokens' listener persists those refreshes.
 */
export const getUserAuth = async (userId: string): Promise<OAuth2Client> => {
  const { rows } = await db.query(
    'SELECT access_token, refresh_token, expiry_date FROM user_google_tokens WHERE user_id = $1',
    [userId]
  );

  if (rows.length === 0) {
    throw new UnauthorizedError(
      'Google account not connected. Sign in with Google to use Drive features.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: rows[0].access_token,
    refresh_token: rows[0].refresh_token || undefined,
    expiry_date: rows[0].expiry_date ? Number(rows[0].expiry_date) : undefined,
  });

  oauth2Client.on('tokens', (tokens) => {
    saveGoogleTokens(userId, tokens).catch((err) =>
      console.error('Failed to persist refreshed Google tokens', err)
    );
  });

  return oauth2Client;
};

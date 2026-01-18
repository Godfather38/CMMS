import { google, drive_v3, docs_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

// Helper to construct an authenticated client for a specific user
// In production, fetch tokens from DB (users table or user_secrets table)
const getUserAuth = async (userId: string): Promise<OAuth2Client> => {
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  // MOCK: Retrieving tokens from DB.
  // Replace this with actual DB call: SELECT access_token, refresh_token FROM ...
  // For now, we assume the mechanism exists.
  // const tokens = await db.getUserTokens(userId);
  // oauth2Client.setCredentials(tokens);

  // If we don't have this implemented, operations will fail without valid creds.
  // Throwing a descriptive error for the purpose of this file generation.
  // To make this runnable without DB tokens, one might pass tokens in headers,
  // but standard OAuth flow stores them backend side.
  
  // Placeholder for type safety in this file generation:
  // oauth2Client.setCredentials({ access_token: '...', refresh_token: '...' });

  return oauth2Client; 
};

export const getFileMetadata = async (userId: string, fileId: string) => {
  try {
    const auth = await getUserAuth(userId);
    const drive = google.drive({ version: 'v3', auth });
    
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, parents, modifiedTime, appProperties',
    });

    return res.data;
  } catch (error: any) {
    if (error.code === 404) throw new AppError('File not found in Google Drive', 404);
    if (error.code === 403) throw new AppError('Permission denied for this file', 403);
    throw error;
  }
};

export const copyFileToFolder = async (userId: string, fileId: string, folderId: string, name?: string) => {
  const auth = await getUserAuth(userId);
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.copy({
    fileId,
    requestBody: {
      parents: [folderId],
      name: name,
    },
    fields: 'id, name, mimeType, parents, modifiedTime',
  });

  return res.data;
};

export const createDocument = async (userId: string, title: string, folderId?: string, initialText?: string) => {
  const auth = await getUserAuth(userId);
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  // 1. Create the Doc
  const createRes = await docs.documents.create({
    requestBody: { title },
  });
  
  const docId = createRes.data.documentId!;

  // 2. Insert Text if provided
  if (initialText) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: 1 },
            text: initialText
          }
        }]
      }
    });
  }

  // 3. Move to folder if specified (Docs are created in root by default)
  if (folderId) {
    // Get current parents to remove them
    const fileRes = await drive.files.get({ fileId: docId, fields: 'parents' });
    const previousParents = fileRes.data.parents?.join(',') || '';
    
    await drive.files.update({
      fileId: docId,
      addParents: folderId,
      removeParents: previousParents,
      fields: 'id, parents',
    });
  }

  return createRes.data;
};

export const updateFileProperties = async (
  userId: string, 
  fileId: string, 
  properties: { [key: string]: string }
) => {
  const auth = await getUserAuth(userId);
  const drive = google.drive({ version: 'v3', auth });

  await drive.files.update({
    fileId,
    requestBody: {
      appProperties: properties
    }
  });
};
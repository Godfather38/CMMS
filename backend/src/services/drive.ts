import { google, drive_v3 } from 'googleapis';
import { AppError } from '../utils/errors';
import { getUserAuth } from './googleAuth';

export const listFilesInFolder = async (
  userId: string,
  folderId: string
): Promise<drive_v3.Schema$File[]> => {
  const auth = await getUserAuth(userId);
  const drive = google.drive({ version: 'v3', auth });

  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
      fields: 'nextPageToken, files(id, name, modifiedTime, appProperties)',
      pageSize: 100,
      pageToken,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return files;
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
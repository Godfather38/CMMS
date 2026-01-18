import { google, docs_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

// Helper to construct authenticated client (Duplicated logic for now, ideally shared)
const getUserAuth = async (userId: string): Promise<OAuth2Client> => {
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  // Placeholder: Load tokens from DB
  // oauth2Client.setCredentials({ access_token: ... });
  return oauth2Client;
};

export const fetchDocument = async (userId: string, googleDocId: string) => {
  try {
    const auth = await getUserAuth(userId);
    const docs = google.docs({ version: 'v1', auth });

    const res = await docs.documents.get({
      documentId: googleDocId,
      // We need body for text content and namedRanges for markers
      fields: 'documentId,title,body,namedRanges', 
    });

    return res.data;
  } catch (error: any) {
    if (error.code === 404) throw new AppError('Document not found in Google Drive', 404);
    if (error.code === 403) throw new AppError('Permission denied for this document', 403);
    throw error;
  }
};

/**
 * Reconstructs the full plain text of the document to allow 
 * slicing by start/end offsets.
 */
export const extractFullText = (doc: docs_v1.Schema$Document): string => {
  if (!doc.body || !doc.body.content) return '';

  let text = '';
  
  // Google Docs structure is a list of StructuralElements
  // We iterate and extract text from Paragraphs, Tables, etc.
  for (const element of doc.body.content) {
    text += readStructuralElement(element);
  }

  return text;
};

const readStructuralElement = (element: docs_v1.Schema$StructuralElement): string => {
  let text = '';

  if (element.paragraph) {
    for (const elem of element.paragraph.elements || []) {
      if (elem.textRun) {
        text += elem.textRun.content || '';
      }
    }
  } else if (element.table) {
    for (const row of element.table.tableRows || []) {
      for (const cell of row.tableCells || []) {
        for (const content of cell.content || []) {
          text += readStructuralElement(content);
        }
      }
    }
  } else if (element.tableOfContents) {
    for (const content of element.tableOfContents.content || []) {
      text += readStructuralElement(content);
    }
  } else if (element.sectionBreak) {
    // Section breaks might add a newline in the index count? 
    // Usually treated as non-printable or handled within the index structure.
    // We'll leave empty unless specific issues arise.
  }

  return text;
};

export const getCmmsNamedRanges = (doc: docs_v1.Schema$Document) => {
  const ranges = doc.namedRanges || {};
  const cmmsRanges: Record<string, { start: number; end: number }> = {};

  for (const [name, rangeObj] of Object.entries(ranges)) {
    if (name.startsWith('cmms_segment_') && rangeObj.namedRanges && rangeObj.namedRanges.length > 0) {
      // Named ranges can be split (e.g. across pages), but for segments we assume contiguous 
      // or take the outer bounds. Using the first range instance for now.
      const range = rangeObj.namedRanges[0].ranges?.[0];
      if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number') {
        const segmentId = name.replace('cmms_segment_', '');
        cmmsRanges[segmentId] = {
          start: range.startIndex,
          end: range.endIndex
        };
      }
    }
  }

  return cmmsRanges;
};
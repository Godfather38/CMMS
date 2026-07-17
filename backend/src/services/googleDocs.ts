import { google, docs_v1 } from 'googleapis';
import { AppError } from '../utils/errors';
import { getUserAuth } from './googleAuth';

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
    if (!name.startsWith('cmms_segment_')) continue;

    // Docs fragments named ranges after heavy edits (multiple instances, each
    // with multiple sub-ranges). Take the outer bounds across all of them.
    let start = Infinity;
    let end = -Infinity;
    for (const instance of rangeObj.namedRanges || []) {
      for (const range of instance.ranges || []) {
        if (typeof range.startIndex === 'number' && range.startIndex < start) start = range.startIndex;
        if (typeof range.endIndex === 'number' && range.endIndex > end) end = range.endIndex;
      }
    }

    if (start !== Infinity && end !== -Infinity) {
      cmmsRanges[name.replace('cmms_segment_', '')] = { start, end };
    }
  }

  return cmmsRanges;
};

/**
 * Extract the exact text a [startIndex, endIndex) span covers, in the Docs
 * API's own index space (body starts at index 1; tables, section breaks, and
 * inline objects consume indexes without contributing text; indexes count
 * UTF-16 code units, same as JS string offsets).
 *
 * This is the single source of truth for marker text — used both when a
 * segment is created from a named range and when sync re-reads it — so the
 * producer and the sync engine can never disagree.
 */
export const extractTextForRange = (
  doc: docs_v1.Schema$Document,
  startIndex: number,
  endIndex: number
): string => {
  if (!doc.body || !doc.body.content) return '';
  return sliceStructuralElements(doc.body.content, startIndex, endIndex);
};

const sliceStructuralElements = (
  elements: docs_v1.Schema$StructuralElement[],
  startIndex: number,
  endIndex: number
): string => {
  let text = '';

  for (const el of elements) {
    if (typeof el.endIndex === 'number' && el.endIndex <= startIndex) continue;
    if (typeof el.startIndex === 'number' && el.startIndex >= endIndex) break; // content is ordered

    if (el.paragraph) {
      for (const pe of el.paragraph.elements || []) {
        if (!pe.textRun || typeof pe.startIndex !== 'number' || typeof pe.endIndex !== 'number') {
          continue; // inline objects / page breaks consume an index but hold no text
        }
        const from = Math.max(startIndex, pe.startIndex);
        const to = Math.min(endIndex, pe.endIndex);
        if (to > from) {
          text += (pe.textRun.content || '').substring(from - pe.startIndex, to - pe.startIndex);
        }
      }
    } else if (el.table) {
      for (const row of el.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          text += sliceStructuralElements(cell.content || [], startIndex, endIndex);
        }
      }
    } else if (el.tableOfContents) {
      text += sliceStructuralElements(el.tableOfContents.content || [], startIndex, endIndex);
    }
    // sectionBreak: consumes an index, contributes no text
  }

  return text;
};
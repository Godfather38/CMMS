import { describe, it, expect } from 'vitest';
import { extractFullText, extractTextForRange, getCmmsNamedRanges } from '../googleDocs';
import type { docs_v1 } from 'googleapis';

const fixtureDoc: docs_v1.Schema$Document = {
  documentId: 'doc-1',
  title: 'Fixture Doc',
  body: {
    content: [
      {
        paragraph: {
          elements: [
            { textRun: { content: 'Why do gas station bathrooms ' } },
            { textRun: { content: 'always have that one wet spot?\n' } },
          ],
        },
      },
      {
        table: {
          tableRows: [
            {
              tableCells: [
                { content: [{ paragraph: { elements: [{ textRun: { content: 'cell one ' } }] } }] },
                { content: [{ paragraph: { elements: [{ textRun: { content: 'cell two\n' } }] } }] },
              ],
            },
          ],
        },
      },
      { sectionBreak: {} },
    ],
  },
  namedRanges: {
    'cmms_segment_abc-123': {
      namedRanges: [
        {
          name: 'cmms_segment_abc-123',
          ranges: [{ startIndex: 0, endIndex: 58 }],
        },
      ],
    },
    'cmms_segment_def-456': {
      namedRanges: [
        {
          name: 'cmms_segment_def-456',
          ranges: [{ startIndex: 60, endIndex: 70 }],
        },
      ],
    },
    'user_bookmark': {
      namedRanges: [{ name: 'user_bookmark', ranges: [{ startIndex: 5, endIndex: 10 }] }],
    },
  },
};

describe('extractFullText', () => {
  it('concatenates paragraph and table text in order', () => {
    expect(extractFullText(fixtureDoc)).toBe(
      'Why do gas station bathrooms always have that one wet spot?\ncell one cell two\n'
    );
  });

  it('returns empty string for a document with no body', () => {
    expect(extractFullText({ documentId: 'empty' })).toBe('');
  });
});

/**
 * Fixture with REAL Docs API index arithmetic: body starts at index 1,
 * tables and inline objects consume indexes without contributing text.
 *
 * Index map:
 *   [1,21)   run A "Why do gas stations "
 *   [21,41)  run B "always smell weird?\n"
 *   [41,58)  table (structural glyphs at 41/42, 49, 56-57 hold no text)
 *     [43,49)  cell 1 run "cellA\n"
 *     [50,56)  cell 2 run "cellB\n"
 *   [58,72)  paragraph with an inline image:
 *     [58,65)  run C "before "
 *     [65,66)  inlineObjectElement (1 index, no text)
 *     [66,72)  run D "after\n"
 */
const indexedDoc: docs_v1.Schema$Document = {
  documentId: 'indexed-doc',
  body: {
    content: [
      {
        startIndex: 1,
        endIndex: 41,
        paragraph: {
          elements: [
            { startIndex: 1, endIndex: 21, textRun: { content: 'Why do gas stations ' } },
            { startIndex: 21, endIndex: 41, textRun: { content: 'always smell weird?\n' } },
          ],
        },
      },
      {
        startIndex: 41,
        endIndex: 58,
        table: {
          tableRows: [
            {
              tableCells: [
                {
                  content: [
                    {
                      startIndex: 43,
                      endIndex: 49,
                      paragraph: {
                        elements: [{ startIndex: 43, endIndex: 49, textRun: { content: 'cellA\n' } }],
                      },
                    },
                  ],
                },
                {
                  content: [
                    {
                      startIndex: 50,
                      endIndex: 56,
                      paragraph: {
                        elements: [{ startIndex: 50, endIndex: 56, textRun: { content: 'cellB\n' } }],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        startIndex: 58,
        endIndex: 72,
        paragraph: {
          elements: [
            { startIndex: 58, endIndex: 65, textRun: { content: 'before ' } },
            { startIndex: 65, endIndex: 66, inlineObjectElement: { inlineObjectId: 'img1' } },
            { startIndex: 66, endIndex: 72, textRun: { content: 'after\n' } },
          ],
        },
      },
    ],
  },
};

describe('extractTextForRange', () => {
  it('slices within a single run', () => {
    expect(extractTextForRange(indexedDoc, 8, 14)).toBe('gas st');
  });

  it('slices across runs, keeping the paragraph newline', () => {
    expect(extractTextForRange(indexedDoc, 15, 25)).toBe('tions alwa');
  });

  it('returns a whole paragraph exactly — where 0-based substring was off by one', () => {
    const exact = extractTextForRange(indexedDoc, 1, 41);
    expect(exact).toBe('Why do gas stations always smell weird?\n');
    // The old approach: slice the 0-based concatenation with document indexes
    const oldApproach = extractFullText(indexedDoc).substring(1, 41);
    expect(oldApproach).not.toBe(exact); // drops the leading 'W', eats a trailing char
  });

  it('slices across table cells without inventing text for structural indexes', () => {
    expect(extractTextForRange(indexedDoc, 45, 53)).toBe('llA\ncel');
  });

  it('skips inline objects but keeps surrounding text', () => {
    expect(extractTextForRange(indexedDoc, 60, 70)).toBe('fore afte');
  });

  it('returns empty for a document with no body', () => {
    expect(extractTextForRange({ documentId: 'empty' }, 1, 10)).toBe('');
  });
});

describe('getCmmsNamedRanges', () => {
  it('extracts only cmms_segment_* ranges keyed by segment id', () => {
    const ranges = getCmmsNamedRanges(fixtureDoc);
    expect(Object.keys(ranges).sort()).toEqual(['abc-123', 'def-456']);
    expect(ranges['abc-123']).toEqual({ start: 0, end: 58 });
    expect(ranges['def-456']).toEqual({ start: 60, end: 70 });
  });

  it('handles documents with no named ranges', () => {
    expect(getCmmsNamedRanges({ documentId: 'x' })).toEqual({});
  });

  it('takes outer bounds across fragmented instances and sub-ranges', () => {
    const doc: docs_v1.Schema$Document = {
      documentId: 'frag',
      namedRanges: {
        'cmms_segment_frag-1': {
          namedRanges: [
            { name: 'cmms_segment_frag-1', ranges: [{ startIndex: 12, endIndex: 20 }] },
            {
              name: 'cmms_segment_frag-1',
              ranges: [
                { startIndex: 5, endIndex: 9 },
                { startIndex: 9, endIndex: 11 },
              ],
            },
          ],
        },
      },
    };
    expect(getCmmsNamedRanges(doc)['frag-1']).toEqual({ start: 5, end: 20 });
  });
});

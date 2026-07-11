import { describe, it, expect } from 'vitest';
import { extractFullText, getCmmsNamedRanges } from '../googleDocs';
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
});

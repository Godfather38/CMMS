import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { docs_v1 } from 'googleapis';

vi.mock('../../config/database', () => {
  const query = vi.fn();
  const clientQuery = vi.fn();
  const connect = vi.fn(async () => ({ query: clientQuery, release: vi.fn() }));
  return { db: { query, pool: { connect } }, __mocks: { query, clientQuery, connect } };
});

vi.mock('../googleDocs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../googleDocs')>();
  return { ...actual, fetchDocument: vi.fn() };
});

vi.mock('../color', () => ({
  assignColor: vi.fn(async () => '#E57373'),
  recordColorUsage: vi.fn(async () => undefined),
}));

vi.mock('../segments', () => ({
  getSegmentById: vi.fn(),
}));

import { createSegmentFromMarker } from '../segmentsFromMarker';
import * as googleDocs from '../googleDocs';
import * as segments from '../segments';
import { db } from '../../config/database';
import { AppError } from '../../utils/errors';

const MARKER_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const DOC_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';

// Minimal doc with real indexes: "Hello marker world\n" at [1,20),
// marker covering "marker" at [7,13)
const gdoc: docs_v1.Schema$Document = {
  documentId: 'gfile-1',
  body: {
    content: [
      {
        startIndex: 1,
        endIndex: 20,
        paragraph: {
          elements: [{ startIndex: 1, endIndex: 20, textRun: { content: 'Hello marker world\n' } }],
        },
      },
    ],
  },
  namedRanges: {
    [`cmms_segment_${MARKER_ID}`]: {
      namedRanges: [{ name: `cmms_segment_${MARKER_ID}`, ranges: [{ startIndex: 7, endIndex: 13 }] }],
    },
  },
};

const mockedFetch = vi.mocked(googleDocs.fetchDocument);
const mockedGetSegment = vi.mocked(segments.getSegmentById);
const mockedDbQuery = vi.mocked(db.query);

const registeredDocRow = { rows: [{ id: DOC_ID }] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSegmentFromMarker — primary branch', () => {
  it('creates a segment whose id is the marker id, with server-measured offsets and text', async () => {
    mockedDbQuery.mockResolvedValue(registeredDocRow as any);
    const finalSegment = { id: MARKER_ID, document_id: DOC_ID, text_content: 'marker' };
    mockedGetSegment
      .mockResolvedValueOnce(null) // idempotency check
      .mockResolvedValueOnce(finalSegment); // final read-back
    mockedFetch.mockResolvedValue(gdoc as any);

    const result = await createSegmentFromMarker(USER_ID, {
      google_file_id: 'gfile-1',
      marker_id: MARKER_ID,
      category_id: '55555555-5555-4555-8555-555555555555',
      tag_ids: ['66666666-6666-4666-8666-666666666666'],
    });

    expect(result.created).toBe(true);
    expect(result.segment).toBe(finalSegment);

    const client = await vi.mocked(db.pool.connect).mock.results[0].value;
    const insertCall = client.query.mock.calls.find((c: any[]) => String(c[0]).includes('INSERT INTO segments'));
    expect(insertCall).toBeTruthy();
    const params = insertCall![1];
    expect(params[0]).toBe(MARKER_ID); // id = marker uuid
    expect(params[4]).toBe(7); // start offset in Docs index space
    expect(params[5]).toBe(13); // end offset
    expect(params[6]).toBe('marker'); // exact covered text
    expect(params[8]).toBe('#E57373'); // auto-assigned color

    const tagCall = client.query.mock.calls.find((c: any[]) => String(c[0]).includes('segment_tags'));
    expect(tagCall).toBeTruthy();
  });

  it('is idempotent: an existing segment with the marker id in the same doc returns created:false', async () => {
    mockedDbQuery.mockResolvedValue(registeredDocRow as any);
    mockedGetSegment.mockResolvedValueOnce({ id: MARKER_ID, document_id: DOC_ID });

    const result = await createSegmentFromMarker(USER_ID, {
      google_file_id: 'gfile-1',
      marker_id: MARKER_ID,
      category_id: '55555555-5555-4555-8555-555555555555',
    });

    expect(result.created).toBe(false);
    expect(mockedFetch).not.toHaveBeenCalled(); // no Google round-trip needed
  });

  it('rejects a marker id already used in another document (409)', async () => {
    mockedDbQuery.mockResolvedValue(registeredDocRow as any);
    mockedGetSegment.mockResolvedValueOnce({ id: MARKER_ID, document_id: 'some-other-doc' });

    await expect(
      createSegmentFromMarker(USER_ID, {
        google_file_id: 'gfile-1',
        marker_id: MARKER_ID,
        category_id: '55555555-5555-4555-8555-555555555555',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('404s for an unregistered document before touching Google', async () => {
    mockedDbQuery.mockResolvedValue({ rows: [] } as any);

    await expect(
      createSegmentFromMarker(USER_ID, {
        google_file_id: 'not-registered',
        marker_id: MARKER_ID,
        category_id: '55555555-5555-4555-8555-555555555555',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('422s when the marker is not present in the document', async () => {
    mockedDbQuery.mockResolvedValue(registeredDocRow as any);
    mockedGetSegment.mockResolvedValueOnce(null);
    mockedFetch.mockResolvedValue({ documentId: 'gfile-1', body: gdoc.body } as any); // no namedRanges

    await expect(
      createSegmentFromMarker(USER_ID, {
        google_file_id: 'gfile-1',
        marker_id: MARKER_ID,
        category_id: '55555555-5555-4555-8555-555555555555',
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('createSegmentFromMarker — associate branch', () => {
  it('creates a non-primary linked copy inheriting from the source and records the association', async () => {
    mockedDbQuery.mockResolvedValue(registeredDocRow as any);
    const source = {
      id: SOURCE_ID,
      category_id: 'cat-1',
      title: 'Gas Station Hands',
      color: '#BA68C8',
    };
    const finalSegment = { id: MARKER_ID, document_id: DOC_ID };
    mockedGetSegment.mockImplementation(async (_user: string, id: string) => {
      if (id === MARKER_ID) {
        return mockedGetSegment.mock.calls.filter((c) => c[1] === MARKER_ID).length > 1 ? finalSegment : null;
      }
      if (id === SOURCE_ID) return source;
      return null;
    });
    mockedFetch.mockResolvedValue(gdoc as any);

    const result = await createSegmentFromMarker(USER_ID, {
      google_file_id: 'gfile-1',
      marker_id: MARKER_ID,
      associate_with_segment_id: SOURCE_ID,
      association_type: 'callback',
    });

    expect(result.created).toBe(true);

    const client = await vi.mocked(db.pool.connect).mock.results[0].value;
    const insertSegment = client.query.mock.calls.find((c: any[]) => String(c[0]).includes('INSERT INTO segments'));
    expect(insertSegment![0]).toContain('false'); // is_primary = false
    expect(insertSegment![1][3]).toBe('cat-1'); // inherited category
    expect(insertSegment![1][8]).toBe('#BA68C8'); // inherited color

    const insertAssoc = client.query.mock.calls.find((c: any[]) => String(c[0]).includes('segment_associations'));
    expect(insertAssoc![1]).toEqual([SOURCE_ID, MARKER_ID, 'callback']);
  });
});

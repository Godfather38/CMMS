import { describe, it, expect } from 'vitest';
import { pickColor, DEFAULT_PALETTE, ColorUsageStats } from '../color';

const usage = (entries: [string, { lastUsed: number; count: number }][]) =>
  new Map<string, ColorUsageStats>(
    entries.map(([color, { lastUsed, count }]) => [color, { lastUsed: new Date(lastUsed), count }])
  );

describe('pickColor', () => {
  it('picks the least-recently-used color in a fresh document', () => {
    const usageMap = usage([
      ['#E57373', { lastUsed: 3000, count: 5 }],
      ['#81C784', { lastUsed: 1000, count: 2 }], // oldest use
      ['#64B5F6', { lastUsed: 2000, count: 9 }],
    ]);
    // Never-used palette colors sort before any used ones (time 0)
    expect(pickColor(['#E57373', '#81C784', '#64B5F6'], new Set(), usageMap)).toBe('#81C784');
  });

  it('prefers never-used colors over recently used ones', () => {
    const usageMap = usage([['#E57373', { lastUsed: 1000, count: 1 }]]);
    expect(pickColor(['#E57373', '#81C784'], new Set(), usageMap)).toBe('#81C784');
  });

  it('skips colors already used in the document', () => {
    const usedInDoc = new Set(['#E57373', '#81C784']);
    expect(pickColor(['#E57373', '#81C784', '#64B5F6'], usedInDoc, usage([]))).toBe('#64B5F6');
  });

  it('falls back to the globally least-used color when the palette is exhausted in-doc', () => {
    const usedInDoc = new Set(['#E57373', '#81C784', '#64B5F6']);
    const usageMap = usage([
      ['#E57373', { lastUsed: 1000, count: 7 }],
      ['#81C784', { lastUsed: 2000, count: 2 }], // least used globally
      ['#64B5F6', { lastUsed: 3000, count: 4 }],
    ]);
    expect(pickColor(['#E57373', '#81C784', '#64B5F6'], usedInDoc, usageMap)).toBe('#81C784');
  });

  it('works with the default palette and empty state', () => {
    const color = pickColor(DEFAULT_PALETTE, new Set(), new Map());
    expect(DEFAULT_PALETTE).toContain(color);
  });

  it('does not mutate the caller-supplied palette', () => {
    const palette = ['#111111', '#222222', '#333333'];
    const copy = [...palette];
    pickColor(palette, new Set(palette), usage([['#333333', { lastUsed: 1, count: 0 }]]));
    expect(palette).toEqual(copy);
  });
});

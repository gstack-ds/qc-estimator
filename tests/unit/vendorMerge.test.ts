import { describe, it, expect } from 'vitest';
import { mergeJsonb, mergeText, detectDuplicateSpaces } from '../../src/lib/vendors/mergeLogic';

// ─── mergeJsonb ───────────────────────────────────────────

describe('mergeJsonb', () => {
  it('keeps survivor when it is a non-empty array', () => {
    expect(mergeJsonb([{ name: 'Menu A' }], [{ name: 'Menu B' }])).toEqual([{ name: 'Menu A' }]);
  });

  it('uses loser when survivor is an empty array', () => {
    expect(mergeJsonb([], [{ name: 'Menu B' }])).toEqual([{ name: 'Menu B' }]);
  });

  it('uses loser when survivor is null', () => {
    expect(mergeJsonb(null, [{ name: 'Menu B' }])).toEqual([{ name: 'Menu B' }]);
  });

  it('returns loser even when both are empty arrays', () => {
    expect(mergeJsonb([], [])).toEqual([]);
  });

  it('returns null loser when survivor is empty and loser is null', () => {
    expect(mergeJsonb([], null)).toBeNull();
  });

  it('keeps survivor when loser is null', () => {
    expect(mergeJsonb([{ name: 'Menu A' }], null)).toEqual([{ name: 'Menu A' }]);
  });

  it('keeps survivor object when non-empty', () => {
    expect(mergeJsonb({ foo: 1 }, { foo: 2 })).toEqual({ foo: 1 });
  });
});

// ─── mergeText ────────────────────────────────────────────

describe('mergeText', () => {
  it('keeps survivor when set', () => {
    expect(mergeText('Charlotte', 'Atlanta')).toBe('Charlotte');
  });

  it('uses loser when survivor is null', () => {
    expect(mergeText(null, 'Atlanta')).toBe('Atlanta');
  });

  it('uses loser when survivor is empty string', () => {
    expect(mergeText('', 'Atlanta')).toBe('Atlanta');
  });

  it('uses loser when survivor is undefined', () => {
    expect(mergeText(undefined, 'Atlanta')).toBe('Atlanta');
  });

  it('returns null when both are null', () => {
    expect(mergeText(null, null)).toBeNull();
  });

  it('returns null when survivor is null and loser is undefined', () => {
    expect(mergeText(null, undefined)).toBeNull();
  });

  it('keeps survivor when both are set', () => {
    expect(mergeText('John Smith', 'Jane Doe')).toBe('John Smith');
  });
});

// ─── detectDuplicateSpaces ────────────────────────────────

describe('detectDuplicateSpaces', () => {
  it('returns empty array when there is no overlap', () => {
    const s = [{ id: 's1', name: 'Ballroom' }];
    const l = [{ id: 'l1', name: 'Rooftop' }];
    expect(detectDuplicateSpaces(s, l)).toHaveLength(0);
  });

  it('detects exact name match', () => {
    const s = [{ id: 's1', name: 'Ballroom' }];
    const l = [{ id: 'l1', name: 'Ballroom' }];
    const result = detectDuplicateSpaces(s, l);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ survivorSpaceId: 's1', loserSpaceId: 'l1', name: 'Ballroom' });
  });

  it('detects case-insensitive match', () => {
    const s = [{ id: 's1', name: 'Ballroom' }];
    const l = [{ id: 'l1', name: 'ballroom' }];
    const result = detectDuplicateSpaces(s, l);
    expect(result).toHaveLength(1);
    expect(result[0].survivorSpaceId).toBe('s1');
    expect(result[0].loserSpaceId).toBe('l1');
  });

  it('detects whitespace-normalized match', () => {
    const s = [{ id: 's1', name: '  Ballroom  ' }];
    const l = [{ id: 'l1', name: 'Ballroom' }];
    expect(detectDuplicateSpaces(s, l)).toHaveLength(1);
  });

  it('returns only matching loser spaces, not all loser spaces', () => {
    const s = [{ id: 's1', name: 'Ballroom' }, { id: 's2', name: 'Terrace' }];
    const l = [{ id: 'l1', name: 'Ballroom' }, { id: 'l2', name: 'Rooftop' }];
    const result = detectDuplicateSpaces(s, l);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ballroom');
  });

  it('returns empty array when loser spaces is empty', () => {
    const s = [{ id: 's1', name: 'Ballroom' }];
    expect(detectDuplicateSpaces(s, [])).toHaveLength(0);
  });

  it('returns empty array when survivor spaces is empty', () => {
    const l = [{ id: 'l1', name: 'Ballroom' }];
    expect(detectDuplicateSpaces([], l)).toHaveLength(0);
  });

  it('detects multiple duplicates', () => {
    const s = [{ id: 's1', name: 'Ballroom' }, { id: 's2', name: 'Terrace' }];
    const l = [{ id: 'l1', name: 'Ballroom' }, { id: 'l2', name: 'Terrace' }];
    const result = detectDuplicateSpaces(s, l);
    expect(result).toHaveLength(2);
  });
});

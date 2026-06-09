import { describe, it, expect } from 'vitest';
import {
  classifySpaceSync,
  normalizeSpaceName,
  findMatchingSpace,
  isAutoFilled,
} from '../../src/lib/vendors/venueSync';

// ─── classifySpaceSync ────────────────────────────────────

describe('classifySpaceSync', () => {
  it('returns no_value when estimate value is 0', () => {
    expect(classifySpaceSync(0, null)).toBe('no_value');
    expect(classifySpaceSync(0, 5000)).toBe('no_value');
    expect(classifySpaceSync(0, 0)).toBe('no_value');
  });

  it('returns no_value when estimate value is negative', () => {
    expect(classifySpaceSync(-100, null)).toBe('no_value');
  });

  it('returns blank_vendor when space value is null', () => {
    expect(classifySpaceSync(5000, null)).toBe('blank_vendor');
    expect(classifySpaceSync(1, null)).toBe('blank_vendor');
  });

  it('returns blank_vendor when space value is undefined', () => {
    expect(classifySpaceSync(5000, undefined)).toBe('blank_vendor');
  });

  it('returns blank_vendor when space value is 0', () => {
    expect(classifySpaceSync(5000, 0)).toBe('blank_vendor');
  });

  it('returns in_sync when values match exactly', () => {
    expect(classifySpaceSync(5000, 5000)).toBe('in_sync');
    expect(classifySpaceSync(2500, 2500)).toBe('in_sync');
  });

  it('returns differing when estimate is higher than vendor', () => {
    expect(classifySpaceSync(6000, 5000)).toBe('differing');
  });

  it('returns differing when estimate is lower than vendor', () => {
    expect(classifySpaceSync(3000, 5000)).toBe('differing');
  });
});

// ─── normalizeSpaceName ───────────────────────────────────

describe('normalizeSpaceName', () => {
  it('lowercases the string', () => {
    expect(normalizeSpaceName('Ballroom A')).toBe('ballrooma');
  });

  it('strips spaces and punctuation', () => {
    expect(normalizeSpaceName('Main Dining Room')).toBe('maindiningroom');
    expect(normalizeSpaceName("The Governor's Suite")).toBe('thegovernorssuite');
  });

  it('strips hyphens and slashes', () => {
    expect(normalizeSpaceName('Level-2 / East Wing')).toBe('level2eastWing'.toLowerCase());
  });

  it('returns empty string for empty input', () => {
    expect(normalizeSpaceName('')).toBe('');
  });
});

// ─── findMatchingSpace ────────────────────────────────────

const SPACES = [
  { id: 's1', name: 'Ballroom A' },
  { id: 's2', name: 'Main Dining Room' },
  { id: 's3', name: 'Rooftop Terrace' },
];

describe('findMatchingSpace', () => {
  it('finds an exact match', () => {
    const result = findMatchingSpace('Ballroom A', SPACES);
    expect(result?.id).toBe('s1');
  });

  it('matches case-insensitively', () => {
    const result = findMatchingSpace('ballroom a', SPACES);
    expect(result?.id).toBe('s1');
  });

  it('matches after stripping spaces', () => {
    const result = findMatchingSpace('BallroomA', SPACES);
    expect(result?.id).toBe('s1');
  });

  it('matches after stripping punctuation', () => {
    const result = findMatchingSpace('Main-Dining-Room', SPACES);
    expect(result?.id).toBe('s2');
  });

  it('returns null when no match', () => {
    const result = findMatchingSpace('Garden Patio', SPACES);
    expect(result).toBeNull();
  });

  it('returns null for empty name', () => {
    const result = findMatchingSpace('', SPACES);
    expect(result).toBeNull();
  });

  it('returns null for whitespace-only name', () => {
    const result = findMatchingSpace('   ', SPACES);
    expect(result).toBeNull();
  });

  it('returns null when spaces array is empty', () => {
    const result = findMatchingSpace('Ballroom A', []);
    expect(result).toBeNull();
  });
});

// ─── isAutoFilled ─────────────────────────────────────────

describe('isAutoFilled', () => {
  it('returns true when current value equals the auto-filled value', () => {
    expect(isAutoFilled(5000, 5000)).toBe(true);
  });

  it('returns true for zero when auto-filled was zero', () => {
    expect(isAutoFilled(0, 0)).toBe(true);
  });

  it('returns false when current value differs from auto-filled', () => {
    expect(isAutoFilled(6000, 5000)).toBe(false);
    expect(isAutoFilled(3000, 5000)).toBe(false);
  });

  it('returns false when auto-filled value is undefined (never set)', () => {
    expect(isAutoFilled(5000, undefined)).toBe(false);
    expect(isAutoFilled(0, undefined)).toBe(false);
  });
});

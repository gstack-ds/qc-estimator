import { describe, it, expect } from 'vitest';
import {
  CALLOUT_CATEGORIES,
  categoryClasses,
  normalizeCategory,
  isOpen,
  countOpen,
  openCountByEstimate,
  openCountByEvent,
  type CalloutLike,
} from '../../src/lib/callouts/constants';

const sample: CalloutLike[] = [
  { estimate_id: 'e1', event_id: 'ev1', status: 'open' },
  { estimate_id: 'e1', event_id: 'ev1', status: 'open' },
  { estimate_id: 'e1', event_id: 'ev1', status: 'resolved' },
  { estimate_id: 'e2', event_id: 'ev1', status: 'open' },
  { estimate_id: 'e3', event_id: null, status: 'open' },
  { estimate_id: 'e3', event_id: null, status: 'resolved' },
];

describe('CALLOUT_CATEGORIES', () => {
  it('is the 5 seed categories in order', () => {
    expect(CALLOUT_CATEGORIES).toEqual([
      'Venue/Capacity',
      'AV/Permitting',
      'Vendor/Timing',
      'Budget',
      'Other',
    ]);
  });
});

describe('normalizeCategory', () => {
  it('maps known categories case-insensitively', () => {
    expect(normalizeCategory('Budget')).toBe('Budget');
    expect(normalizeCategory('  vendor/timing ')).toBe('Vendor/Timing');
  });
  it('returns null for unknown / non-string', () => {
    expect(normalizeCategory('Nonsense')).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
    expect(normalizeCategory(42)).toBeNull();
    expect(normalizeCategory('')).toBeNull();
  });
});

describe('categoryClasses', () => {
  it('returns a class string for each known category', () => {
    for (const c of CALLOUT_CATEGORIES) {
      expect(typeof categoryClasses(c)).toBe('string');
      expect(categoryClasses(c).length).toBeGreaterThan(0);
    }
  });
  it('falls back to Other classes for unknown/null', () => {
    expect(categoryClasses(null)).toBe(categoryClasses('Other'));
    expect(categoryClasses('Whatever')).toBe(categoryClasses('Other'));
  });
});

describe('isOpen', () => {
  it('is true only for "open"', () => {
    expect(isOpen('open')).toBe(true);
    expect(isOpen('resolved')).toBe(false);
    expect(isOpen('')).toBe(false);
  });
});

describe('countOpen', () => {
  it('counts only open callouts', () => {
    expect(countOpen(sample)).toBe(4);
    expect(countOpen([])).toBe(0);
  });
});

describe('openCountByEstimate', () => {
  it('groups open counts per estimate, ignoring resolved', () => {
    expect(openCountByEstimate(sample)).toEqual({ e1: 2, e2: 1, e3: 1 });
  });
  it('returns empty object when nothing open', () => {
    expect(openCountByEstimate([{ estimate_id: 'x', event_id: null, status: 'resolved' }])).toEqual({});
  });
});

describe('openCountByEvent', () => {
  it('groups open counts per event and ignores null event_id', () => {
    expect(openCountByEvent(sample)).toEqual({ ev1: 3 });
  });
});

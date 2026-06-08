import { describe, it, expect } from 'vitest';
import {
  isVendorMenu,
  isBarOption,
  isVendorInclusion,
  parseMenus,
  parseBarOptions,
  parseInclusions,
} from '@/lib/vendors/profileTypes';

// ── isVendorMenu ──────────────────────────────────────────────────────────────

describe('isVendorMenu', () => {
  it('accepts a valid menu', () => {
    expect(isVendorMenu({ id: 'a', name: 'Dinner', courses: [] })).toBe(true);
  });
  it('accepts a menu with optional fields', () => {
    expect(isVendorMenu({
      id: 'a', name: 'Dinner', price_per_person: 95,
      description: 'Four-course', courses: [{ id: 'c1', name: 'Starter', items: [] }],
    })).toBe(true);
  });
  it('rejects missing id', () => {
    expect(isVendorMenu({ name: 'Dinner', courses: [] })).toBe(false);
  });
  it('rejects missing name', () => {
    expect(isVendorMenu({ id: 'a', courses: [] })).toBe(false);
  });
  it('rejects missing courses array', () => {
    expect(isVendorMenu({ id: 'a', name: 'Dinner' })).toBe(false);
  });
  it('rejects non-array courses', () => {
    expect(isVendorMenu({ id: 'a', name: 'Dinner', courses: 'nope' })).toBe(false);
  });
  it('rejects null', () => {
    expect(isVendorMenu(null)).toBe(false);
  });
  it('rejects primitive', () => {
    expect(isVendorMenu('string')).toBe(false);
  });
});

// ── isBarOption ───────────────────────────────────────────────────────────────

describe('isBarOption', () => {
  it('accepts a valid bar option', () => {
    expect(isBarOption({ id: 'b', name: 'Premium Open Bar', categories: [] })).toBe(true);
  });
  it('accepts a bar option with all fields', () => {
    expect(isBarOption({
      id: 'b', name: 'Premium', price_per_person: 45, description: 'Full bar',
      categories: [{ id: 'c', name: 'Spirits', brands: ['Tito\'s', 'Grey Goose'] }],
      notes: 'Domestic beer included',
    })).toBe(true);
  });
  it('rejects missing id', () => {
    expect(isBarOption({ name: 'Bar', categories: [] })).toBe(false);
  });
  it('rejects missing name', () => {
    expect(isBarOption({ id: 'b', categories: [] })).toBe(false);
  });
  it('rejects missing categories array', () => {
    expect(isBarOption({ id: 'b', name: 'Bar' })).toBe(false);
  });
  it('rejects null', () => {
    expect(isBarOption(null)).toBe(false);
  });
});

// ── isVendorInclusion ─────────────────────────────────────────────────────────

describe('isVendorInclusion', () => {
  it('accepts a valid inclusion', () => {
    expect(isVendorInclusion({ id: 'i', text: 'Tables and chairs' })).toBe(true);
  });
  it('rejects missing id', () => {
    expect(isVendorInclusion({ text: 'Tables' })).toBe(false);
  });
  it('rejects missing text', () => {
    expect(isVendorInclusion({ id: 'i' })).toBe(false);
  });
  it('rejects null', () => {
    expect(isVendorInclusion(null)).toBe(false);
  });
});

// ── parseMenus ────────────────────────────────────────────────────────────────

describe('parseMenus', () => {
  it('returns empty array for null', () => {
    expect(parseMenus(null)).toEqual([]);
  });
  it('returns empty array for non-array', () => {
    expect(parseMenus('nope')).toEqual([]);
    expect(parseMenus(42)).toEqual([]);
    expect(parseMenus({})).toEqual([]);
  });
  it('filters out invalid entries', () => {
    const raw = [
      { id: 'a', name: 'Dinner', courses: [] },
      { name: 'Bad — no id', courses: [] },
      null,
      'string',
      { id: 'b', name: 'Lunch', courses: [{ id: 'c', name: 'Starter', items: [] }] },
    ];
    const result = parseMenus(raw);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });
  it('returns all valid entries unchanged', () => {
    const raw = [
      { id: 'a', name: 'Dinner', courses: [] },
      { id: 'b', name: 'Lunch', courses: [] },
    ];
    expect(parseMenus(raw)).toHaveLength(2);
  });
});

// ── parseBarOptions ───────────────────────────────────────────────────────────

describe('parseBarOptions', () => {
  it('returns empty array for null', () => {
    expect(parseBarOptions(null)).toEqual([]);
  });
  it('returns empty array for non-array', () => {
    expect(parseBarOptions({})).toEqual([]);
  });
  it('filters out invalid entries', () => {
    const raw = [
      { id: 'b1', name: 'Premium Bar', categories: [] },
      { name: 'Missing id', categories: [] },
      42,
    ];
    const result = parseBarOptions(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b1');
  });
});

// ── parseInclusions ───────────────────────────────────────────────────────────

describe('parseInclusions', () => {
  it('returns empty array for null', () => {
    expect(parseInclusions(null)).toEqual([]);
  });
  it('returns empty array for non-array', () => {
    expect(parseInclusions('nope')).toEqual([]);
  });
  it('filters out invalid entries', () => {
    const raw = [
      { id: 'i1', text: 'Tables and chairs' },
      { text: 'No id' },
      null,
      { id: 'i2', text: 'Linens' },
    ];
    const result = parseInclusions(raw);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('i1');
    expect(result[1].id).toBe('i2');
  });
});

import { describe, it, expect } from 'vitest';
import { isDefaultEstimateName, seedEstimateName } from '../../src/lib/estimates/naming';

describe('isDefaultEstimateName', () => {
  it('is true for blank and the default placeholders', () => {
    expect(isDefaultEstimateName('')).toBe(true);
    expect(isDefaultEstimateName('   ')).toBe(true);
    expect(isDefaultEstimateName('New Estimate')).toBe(true);
    expect(isDefaultEstimateName('New Venue Estimate')).toBe(true);
    expect(isDefaultEstimateName('New AV Estimate')).toBe(true);
    expect(isDefaultEstimateName('New Decor Estimate')).toBe(true);
    expect(isDefaultEstimateName('New Transportation Estimate')).toBe(true);
    expect(isDefaultEstimateName('New Tour Estimate')).toBe(true);
    expect(isDefaultEstimateName(null)).toBe(true);
    expect(isDefaultEstimateName(undefined)).toBe(true);
  });

  it('is false for any name the user has set (never clobber)', () => {
    expect(isDefaultEstimateName('The Ballantyne')).toBe(false);
    expect(isDefaultEstimateName('Two Urban Licks — Patio')).toBe(false);
    expect(isDefaultEstimateName('New Estimate (copy)')).toBe(false);
    expect(isDefaultEstimateName('Welcome Reception Venue')).toBe(false);
    // a duplicate of a default-named estimate becomes "New Estimate (copy)" — must NOT reseed
    expect(isDefaultEstimateName('New Venue Estimate (copy)')).toBe(false);
  });
});

describe('seedEstimateName', () => {
  it('combines venue and space with an em dash', () => {
    expect(seedEstimateName('The Ballantyne', 'Grand Ballroom')).toBe('The Ballantyne — Grand Ballroom');
  });
  it('uses venue only when no space', () => {
    expect(seedEstimateName('The Ballantyne', null)).toBe('The Ballantyne');
    expect(seedEstimateName('The Ballantyne', '')).toBe('The Ballantyne');
    expect(seedEstimateName('The Ballantyne')).toBe('The Ballantyne');
  });
  it('trims whitespace on both parts', () => {
    expect(seedEstimateName('  The Ballantyne  ', '  Patio  ')).toBe('The Ballantyne — Patio');
  });
});

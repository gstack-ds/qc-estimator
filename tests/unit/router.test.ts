import { describe, it, expect } from 'vitest';
import { suggestOwner } from '../../src/lib/scanner/router';

describe('suggestOwner', () => {
  // Abbie — NC + SC
  it('matches Charlotte → Abbie', () => {
    expect(suggestOwner('Charlotte', 'Charlotte', 'NC')).toBe('Abbie');
  });

  it('matches North Carolina (full state name) → Abbie', () => {
    expect(suggestOwner('North Carolina')).toBe('Abbie');
  });

  it('matches Raleigh → Abbie', () => {
    expect(suggestOwner(null, 'Raleigh', 'NC')).toBe('Abbie');
  });

  it('matches Asheville → Abbie', () => {
    expect(suggestOwner(null, 'Asheville', 'NC')).toBe('Abbie');
  });

  it('matches South Carolina → Abbie', () => {
    expect(suggestOwner('South Carolina')).toBe('Abbie');
  });

  it('matches Charleston SC → Abbie', () => {
    expect(suggestOwner(null, 'Charleston', 'SC')).toBe('Abbie');
  });

  // Lindsey — DMV + NY
  it('matches DC → Lindsey', () => {
    expect(suggestOwner('DC')).toBe('Lindsey');
  });

  it('matches Washington D.C. → Lindsey', () => {
    expect(suggestOwner('Washington D.C.')).toBe('Lindsey');
  });

  it('matches Virginia → Lindsey', () => {
    expect(suggestOwner('Northern Virginia', 'McLean', 'VA')).toBe('Lindsey');
  });

  it('matches New York → Lindsey', () => {
    expect(suggestOwner(null, 'New York', 'NY')).toBe('Lindsey');
  });

  it('matches Maryland → Lindsey', () => {
    expect(suggestOwner(null, 'Bethesda', 'MD')).toBe('Lindsey');
  });

  // Khloe — Georgia + Philadelphia/PA
  it('matches Atlanta → Khloe', () => {
    expect(suggestOwner(null, 'Atlanta', 'GA')).toBe('Khloe');
  });

  it('matches Georgia → Khloe', () => {
    expect(suggestOwner('Georgia')).toBe('Khloe');
  });

  it('matches Philadelphia → Khloe', () => {
    expect(suggestOwner(null, 'Philadelphia', 'PA')).toBe('Khloe');
  });

  it('matches Philly → Khloe', () => {
    expect(suggestOwner('Philly')).toBe('Khloe');
  });

  // Unmatched
  it('returns null for unmatched region', () => {
    expect(suggestOwner('Chicago', 'Chicago', 'IL')).toBeNull();
  });

  it('returns null for empty inputs', () => {
    expect(suggestOwner(null, null, null)).toBeNull();
  });

  it('returns null for undefined inputs', () => {
    expect(suggestOwner(undefined)).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(suggestOwner('CHARLOTTE')).toBe('Abbie');
    expect(suggestOwner('atlanta')).toBe('Khloe');
    expect(suggestOwner('WASHINGTON DC')).toBe('Lindsey');
  });
});

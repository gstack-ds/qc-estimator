import { describe, it, expect } from 'vitest';
import { suggestOwner } from '../../src/lib/scanner/router';

describe('suggestOwner', () => {
  it('matches Charlotte → Alex', () => {
    expect(suggestOwner('Charlotte', 'Charlotte', 'NC')).toBe('Alex');
  });

  it('matches North Carolina (full state name) → Alex', () => {
    expect(suggestOwner('North Carolina')).toBe('Alex');
  });

  it('matches Raleigh → Alex', () => {
    expect(suggestOwner(null, 'Raleigh', 'NC')).toBe('Alex');
  });

  it('matches Asheville → Alex', () => {
    expect(suggestOwner(null, 'Asheville', 'NC')).toBe('Alex');
  });

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

  it('matches Philadelphia → Lindsey', () => {
    expect(suggestOwner(null, 'Philadelphia', 'PA')).toBe('Lindsey');
  });

  it('matches Maryland → Lindsey', () => {
    expect(suggestOwner(null, 'Bethesda', 'MD')).toBe('Lindsey');
  });

  it('matches Atlanta → Lydia', () => {
    expect(suggestOwner(null, 'Atlanta', 'GA')).toBe('Lydia');
  });

  it('matches Georgia → Lydia', () => {
    expect(suggestOwner('Georgia')).toBe('Lydia');
  });

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
    expect(suggestOwner('CHARLOTTE')).toBe('Alex');
    expect(suggestOwner('atlanta')).toBe('Lydia');
  });
});

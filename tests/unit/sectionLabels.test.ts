import { describe, it, expect } from 'vitest';
import { labelForBucket } from '../../src/lib/utils/sectionLabels';
import type { SectionRef } from '../../src/lib/utils/sectionLabels';

describe('labelForBucket', () => {
  const sections: SectionRef[] = [
    { taxBucket: 'fb', name: 'Food & Beverage' },
    { taxBucket: 'equipment', name: 'AV Equipment' },
    { taxBucket: 'staffing', name: 'Stage Crew' },
    { taxBucket: 'venue', name: 'Ballroom Rental' },
  ];

  it('returns the section name for a matching bucket', () => {
    expect(labelForBucket(sections, 'fb', 'F&B')).toBe('Food & Beverage');
    expect(labelForBucket(sections, 'equipment', 'Equipment')).toBe('AV Equipment');
    expect(labelForBucket(sections, 'staffing', 'QC Staffing')).toBe('Stage Crew');
    expect(labelForBucket(sections, 'venue', 'Venue Rental')).toBe('Ballroom Rental');
  });

  it('returns the fallback when no section matches the bucket', () => {
    expect(labelForBucket([], 'fb', 'F&B Subtotal')).toBe('F&B Subtotal');
    expect(labelForBucket([{ taxBucket: 'venue', name: 'Ballroom' }], 'fb', 'F&B')).toBe('F&B');
  });

  it('joins multiple sections with the same bucket using " / "', () => {
    const multi: SectionRef[] = [
      { taxBucket: 'equipment', name: 'Photo Opp' },
      { taxBucket: 'equipment', name: 'Linens' },
    ];
    expect(labelForBucket(multi, 'equipment', 'Equipment')).toBe('Photo Opp / Linens');
  });

  it('reflects a renamed section — the summary label updates when the section name changes', () => {
    const renamed: SectionRef[] = [
      { taxBucket: 'fb', name: 'Catering' },
    ];
    expect(labelForBucket(renamed, 'fb', 'Food & Beverage')).toBe('Catering');
  });

  it('is case-sensitive for bucket matching', () => {
    const s: SectionRef[] = [{ taxBucket: 'fb', name: 'Food' }];
    // 'FB' is not a valid TaxBucket but testing the string comparison
    expect(labelForBucket(s, 'venue', 'Venue')).toBe('Venue');
  });
});

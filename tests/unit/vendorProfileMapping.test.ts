import { describe, it, expect } from 'vitest';
import {
  vendorMenuToMenuCourses,
  vendorBarToBarNotes,
  vendorInclusionsToText,
  formatCapacityBanner,
} from '@/lib/slideCopy/vendorProfileMapping';
import type { VendorMenu, BarOption, VendorInclusion } from '@/lib/vendors/profileTypes';

// ── vendorMenuToMenuCourses ───────────────────────────────────────────────────

describe('vendorMenuToMenuCourses', () => {
  const menu: VendorMenu = {
    id: 'm1',
    name: 'Four-Course Dinner',
    price_per_person: 95,
    courses: [
      {
        id: 'c1',
        name: 'Amuse Bouche',
        items: [
          { id: 'i1', name: 'Butternut Squash Bisque', dietary_tags: ['V', 'GF'] },
        ],
      },
      {
        id: 'c2',
        name: 'First Course',
        selection_rule: 'choose 1',
        items: [
          { id: 'i2', name: 'Caesar Salad', dietary_tags: ['GF'] },
          { id: 'i3', name: 'Beet Salad', dietary_tags: ['V', 'GF'] },
        ],
      },
    ],
  };

  it('produces one MenuCourse per VendorMenuCourse', () => {
    const result = vendorMenuToMenuCourses(menu);
    expect(result).toHaveLength(2);
  });

  it('sets scenario="final" for courses without selection_rule', () => {
    const result = vendorMenuToMenuCourses(menu);
    expect(result[0].scenario).toBe('final');
  });

  it('sets scenario="needs_selection" for courses with selection_rule', () => {
    const result = vendorMenuToMenuCourses(menu);
    expect(result[1].scenario).toBe('needs_selection');
  });

  it('copies selectionRule from the course', () => {
    const result = vendorMenuToMenuCourses(menu);
    expect(result[1].selectionRule).toBe('choose 1');
    expect(result[0].selectionRule).toBeUndefined();
  });

  it('marks options as selected+locked for final courses', () => {
    const result = vendorMenuToMenuCourses(menu);
    expect(result[0].options[0].selected).toBe(true);
    expect(result[0].options[0].locked).toBe(true);
  });

  it('marks options as unselected+unlocked for needs_selection courses', () => {
    const result = vendorMenuToMenuCourses(menu);
    expect(result[1].options[0].selected).toBe(false);
    expect(result[1].options[0].locked).toBe(false);
  });

  it('copies dietary_tags to option tags', () => {
    const result = vendorMenuToMenuCourses(menu);
    expect(result[0].options[0].tags).toEqual(['V', 'GF']);
    expect(result[1].options[0].tags).toEqual(['GF']);
  });

  it('handles items with no dietary_tags', () => {
    const m: VendorMenu = {
      id: 'm', name: 'Simple',
      courses: [{ id: 'c', name: 'Main', items: [{ id: 'i', name: 'Steak' }] }],
    };
    const result = vendorMenuToMenuCourses(m);
    expect(result[0].options[0].tags).toEqual([]);
  });

  it('returns empty array for menu with no courses', () => {
    const m: VendorMenu = { id: 'm', name: 'Empty', courses: [] };
    expect(vendorMenuToMenuCourses(m)).toEqual([]);
  });

  it('preserves course name', () => {
    const result = vendorMenuToMenuCourses(menu);
    expect(result[0].name).toBe('Amuse Bouche');
    expect(result[1].name).toBe('First Course');
  });

  it('preserves item name and description', () => {
    const m: VendorMenu = {
      id: 'm', name: 'Test',
      courses: [{
        id: 'c', name: 'Course',
        items: [{ id: 'i', name: 'Duck Confit', description: 'served with jus' }],
      }],
    };
    const result = vendorMenuToMenuCourses(m);
    expect(result[0].options[0].name).toBe('Duck Confit');
    expect(result[0].options[0].description).toBe('served with jus');
  });

  it('does not mutate the input dietary_tags array', () => {
    const tags: ['V', 'GF'] = ['V', 'GF'];
    const m: VendorMenu = {
      id: 'm', name: 'Test',
      courses: [{ id: 'c', name: 'Course', items: [{ id: 'i', name: 'Item', dietary_tags: tags }] }],
    };
    vendorMenuToMenuCourses(m);
    expect(tags).toHaveLength(2);
  });
});

// ── vendorBarToBarNotes ───────────────────────────────────────────────────────

describe('vendorBarToBarNotes', () => {
  const bar: BarOption = {
    id: 'b1',
    name: 'Premium Open Bar',
    price_per_person: 45,
    description: 'Full premium selection',
    categories: [
      { id: 'cat1', name: 'Spirits', brands: ["Tito's", 'Grey Goose', 'Hendrick\'s'] },
      { id: 'cat2', name: 'Beer & Wine', brands: ['Domestic selection'] },
    ],
    notes: 'Does not include shots.',
  };

  it('starts with the bar name in uppercase', () => {
    const result = vendorBarToBarNotes(bar);
    expect(result.startsWith('PREMIUM OPEN BAR')).toBe(true);
  });

  it('includes price per person', () => {
    expect(vendorBarToBarNotes(bar)).toContain('$45 per person');
  });

  it('includes description', () => {
    expect(vendorBarToBarNotes(bar)).toContain('Full premium selection');
  });

  it('formats categories as UPPERCASE: Brand1, Brand2', () => {
    const result = vendorBarToBarNotes(bar);
    expect(result).toContain("SPIRITS: Tito's, Grey Goose, Hendrick's");
    expect(result).toContain('BEER & WINE: Domestic selection');
  });

  it('includes notes', () => {
    expect(vendorBarToBarNotes(bar)).toContain('Does not include shots.');
  });

  it('works with no price, description, notes', () => {
    const minimal: BarOption = {
      id: 'b', name: 'House Bar',
      categories: [{ id: 'c', name: 'Spirits', brands: ['Jack Daniels'] }],
    };
    const result = vendorBarToBarNotes(minimal);
    expect(result).toContain('HOUSE BAR');
    expect(result).toContain('SPIRITS: Jack Daniels');
    expect(result).not.toContain('undefined');
  });

  it('handles empty categories', () => {
    const noCategories: BarOption = { id: 'b', name: 'Open Bar', categories: [] };
    const result = vendorBarToBarNotes(noCategories);
    expect(result.trim()).toBe('OPEN BAR');
  });

  it('handles categories with no brands', () => {
    const nobrands: BarOption = {
      id: 'b', name: 'Bar',
      categories: [{ id: 'c', name: 'Spirits', brands: [] }],
    };
    const result = vendorBarToBarNotes(nobrands);
    expect(result).toContain('SPIRITS');
  });
});

// ── vendorInclusionsToText ────────────────────────────────────────────────────

describe('vendorInclusionsToText', () => {
  it('joins items with newlines', () => {
    const items: VendorInclusion[] = [
      { id: 'i1', text: 'Tables and chairs' },
      { id: 'i2', text: 'Linens' },
      { id: 'i3', text: 'Centerpieces' },
    ];
    expect(vendorInclusionsToText(items)).toBe('Tables and chairs\nLinens\nCenterpieces');
  });

  it('returns empty string for empty array', () => {
    expect(vendorInclusionsToText([])).toBe('');
  });

  it('returns single item without trailing newline', () => {
    expect(vendorInclusionsToText([{ id: 'i', text: 'Parking' }])).toBe('Parking');
  });
});

// ── formatCapacityBanner ──────────────────────────────────────────────────────

describe('formatCapacityBanner', () => {
  it('formats both seated and standing', () => {
    expect(formatCapacityBanner(150, 250)).toBe('150 Seated / 250 Standing');
  });

  it('formats seated only', () => {
    expect(formatCapacityBanner(150, null)).toBe('150 Seated');
  });

  it('formats standing only', () => {
    expect(formatCapacityBanner(null, 250)).toBe('250 Standing');
  });

  it('returns empty string when both are null', () => {
    expect(formatCapacityBanner(null, null)).toBe('');
  });

  it('returns empty string when both are undefined', () => {
    expect(formatCapacityBanner(undefined, undefined)).toBe('');
  });

  it('prepends spaceName when provided', () => {
    expect(formatCapacityBanner(200, 300, 'Rooftop Terrace')).toBe('Rooftop Terrace: 200 Seated / 300 Standing');
  });

  it('omits spaceName when null', () => {
    expect(formatCapacityBanner(200, null, null)).toBe('200 Seated');
  });

  it('omits spaceName when capacity is empty', () => {
    expect(formatCapacityBanner(null, null, 'Grand Ballroom')).toBe('');
  });

  it('handles zero as a valid capacity value', () => {
    expect(formatCapacityBanner(0, 0)).toBe('0 Seated / 0 Standing');
  });
});

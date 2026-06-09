import { describe, it, expect } from 'vitest';
import { mapMenuToLineItems, mapBarToLineItems } from '../../src/lib/vendors/menuImport';
import type { MenuImportSection, MenuImportMarkup } from '../../src/lib/vendors/menuImport';
import { computeBarPricePP } from '../../src/lib/vendors/profileTypes';
import type { VendorMenu, BarOption } from '../../src/lib/vendors/profileTypes';

const FB_SECTION: MenuImportSection = {
  id: 'section-fb-1',
  name: 'Food & Beverage',
  taxBucket: 'fb',
  markupPct: 0.55,
};

const CATERING_MARKUP: MenuImportMarkup = {
  id: 'markup-catering-1',
  markupPct: 0.55,
};

const GUEST_COUNT = 80;

// ─── Menu with menu-level price_per_person ────────────────

describe('menu with price_per_person', () => {
  const menu: VendorMenu = {
    id: 'm1',
    name: 'Gold Package',
    price_per_person: 95,
    courses: [
      {
        id: 'c1',
        name: 'Appetizers',
        items: [
          { id: 'i1', name: 'Bruschetta' },
          { id: 'i2', name: 'Shrimp Cocktail', price: 12 },
        ],
      },
    ],
  };

  it('returns exactly one line item when price_per_person is set', () => {
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(result).toHaveLength(1);
  });

  it('uses menu name as line item name', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.name).toBe('Gold Package');
  });

  it('uses price_per_person as unitPrice', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.unitPrice).toBe(95);
  });

  it('uses guestCount as qty', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.qty).toBe(GUEST_COUNT);
  });

  it('sets taxType to food', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.taxType).toBe('food');
  });

  it('sets sectionId and section name from section arg', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.sectionId).toBe('section-fb-1');
    expect(item.section).toBe('Food & Beverage');
  });

  it('sets taxBucket from section', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.taxBucket).toBe('fb');
  });

  it('sets markupPct from markup arg', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.categoryMarkupPct).toBe(0.55);
    expect(item.defaultMarkupPct).toBe(0.55);
  });

  it('sets categoryId from markup arg', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.categoryId).toBe('markup-catering-1');
  });

  it('marks item as isNew', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.isNew).toBe(true);
  });

  it('uses startSortOrder for the single item', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 5);
    expect(item.sortOrder).toBe(5);
  });
});

// ─── Menu without price_per_person — individual items ────

describe('menu without price_per_person — course items', () => {
  const menu: VendorMenu = {
    id: 'm2',
    name: 'A La Carte',
    courses: [
      {
        id: 'c1',
        name: 'Mains',
        items: [
          { id: 'i1', name: 'Chicken', price: 28 },
          { id: 'i2', name: 'Salmon', price: 35 },
        ],
      },
      {
        id: 'c2',
        name: 'Desserts',
        items: [
          { id: 'i3', name: 'Cheesecake', price: 10 },
        ],
      },
    ],
  };

  it('returns one item per course item', () => {
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(result).toHaveLength(3);
  });

  it('uses course item names', () => {
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    const names = result.map((r) => r.name);
    expect(names).toContain('Chicken');
    expect(names).toContain('Salmon');
    expect(names).toContain('Cheesecake');
  });

  it('uses course item price as unitPrice', () => {
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    const chicken = result.find((r) => r.name === 'Chicken')!;
    expect(chicken.unitPrice).toBe(28);
  });

  it('increments sortOrder from startSortOrder', () => {
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 3);
    expect(result[0].sortOrder).toBe(3);
    expect(result[1].sortOrder).toBe(4);
    expect(result[2].sortOrder).toBe(5);
  });
});

// ─── Menu without price_per_person — items without prices ─

describe('menu without price_per_person — unpriced items default to zero', () => {
  const menu: VendorMenu = {
    id: 'm3',
    name: 'Tasting Menu',
    courses: [
      {
        id: 'c1',
        name: 'Starters',
        items: [
          { id: 'i1', name: 'Caprese Salad' },
          { id: 'i2', name: 'Soup Du Jour' },
        ],
      },
    ],
  };

  it('returns items for each course item', () => {
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(result).toHaveLength(2);
  });

  it('sets unitPrice to 0 for items without a price', () => {
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(result.every((r) => r.unitPrice === 0)).toBe(true);
  });
});

// ─── Menu without price_per_person and no items ──────────

describe('menu without price_per_person and no course items', () => {
  const menu: VendorMenu = {
    id: 'm4',
    name: 'Custom Menu',
    courses: [],
  };

  it('returns one fallback item using menu name', () => {
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Custom Menu');
    expect(result[0].unitPrice).toBe(0);
  });
});

// ─── Markup with null categoryId ─────────────────────────

describe('markup with null categoryId', () => {
  it('passes null categoryId through', () => {
    const menu: VendorMenu = { id: 'm5', name: 'Simple', price_per_person: 50, courses: [] };
    const nullMarkup: MenuImportMarkup = { id: null, markupPct: 0.55 };
    const [item] = mapMenuToLineItems(menu, FB_SECTION, nullMarkup, GUEST_COUNT, 0);
    expect(item.categoryId).toBeNull();
  });
});

// ─── Different guest counts ───────────────────────────────

describe('different guest counts', () => {
  it('uses the provided guestCount for qty', () => {
    const menu: VendorMenu = { id: 'm6', name: 'Dinner', price_per_person: 100, courses: [] };
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, 120, 0);
    expect(item.qty).toBe(120);
  });

  it('works with guestCount of 1', () => {
    const menu: VendorMenu = { id: 'm7', name: 'Sample', price_per_person: 75, courses: [] };
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, 1, 0);
    expect(item.qty).toBe(1);
  });
});

// ─── computeBarPricePP ────────────────────────────────────

const BAR_SIMPLE: BarOption = { id: 'b1', name: 'House Bar', price_per_person: 40, categories: [] };
const BAR_DURATION: BarOption = {
  id: 'b2', name: 'Premium Open Bar', price_per_person: 45,
  base_hours: 2, additional_hour_price_per_person: 12,
  categories: [],
};

describe('computeBarPricePP', () => {
  it('returns price_per_person when no duration fields', () => {
    expect(computeBarPricePP(BAR_SIMPLE)).toBe(40);
    expect(computeBarPricePP(BAR_SIMPLE, null)).toBe(40);
    expect(computeBarPricePP(BAR_SIMPLE, 5)).toBe(40);
  });

  it('returns price_per_person when durationHours is null', () => {
    expect(computeBarPricePP(BAR_DURATION, null)).toBe(45);
  });

  it('returns base price when duration <= base_hours', () => {
    expect(computeBarPricePP(BAR_DURATION, 2)).toBe(45); // exactly at base
    expect(computeBarPricePP(BAR_DURATION, 1)).toBe(45); // under base
  });

  it('adds extra hours beyond base_hours', () => {
    // 3hr: $45 + 1×$12 = $57
    expect(computeBarPricePP(BAR_DURATION, 3)).toBe(57);
    // 5hr: $45 + 3×$12 = $81
    expect(computeBarPricePP(BAR_DURATION, 5)).toBe(81);
  });

  it('handles fractional extra hours', () => {
    // 2.5hr: $45 + 0.5×$12 = $51
    expect(computeBarPricePP(BAR_DURATION, 2.5)).toBe(51);
  });

  it('returns 0 when price_per_person is 0', () => {
    const opt: BarOption = { id: 'b3', name: 'Complimentary', price_per_person: 0, categories: [] };
    expect(computeBarPricePP(opt, 4)).toBe(0);
  });
});

// ─── mapBarToLineItems ────────────────────────────────────

describe('mapBarToLineItems', () => {
  it('creates a single alcohol line item from a simple bar option', () => {
    const [item] = mapBarToLineItems(BAR_SIMPLE, null, FB_SECTION, CATERING_MARKUP, 100, 0);
    expect(item.name).toBe('House Bar');
    expect(item.qty).toBe(100);
    expect(item.unitPrice).toBe(40);
    expect(item.taxType).toBe('alcohol');
    expect(item.taxBucket).toBe('fb');
    expect(item.isNew).toBe(true);
  });

  it('applies duration pricing when durationHours is provided', () => {
    // 4hr: $45 + 2×$12 = $69
    const [item] = mapBarToLineItems(BAR_DURATION, 4, FB_SECTION, CATERING_MARKUP, 50, 0);
    expect(item.unitPrice).toBe(69);
  });

  it('uses base price when no duration provided', () => {
    const [item] = mapBarToLineItems(BAR_DURATION, null, FB_SECTION, CATERING_MARKUP, 50, 0);
    expect(item.unitPrice).toBe(45);
  });

  it('uses guestCount for qty', () => {
    const [item] = mapBarToLineItems(BAR_SIMPLE, null, FB_SECTION, CATERING_MARKUP, 75, 0);
    expect(item.qty).toBe(75);
  });

  it('sets correct section and markup', () => {
    const [item] = mapBarToLineItems(BAR_SIMPLE, null, FB_SECTION, CATERING_MARKUP, 50, 0);
    expect(item.sectionId).toBe('section-fb-1');
    expect(item.categoryMarkupPct).toBe(0.55);
  });

  it('always returns exactly one item', () => {
    const items = mapBarToLineItems(BAR_DURATION, 3, FB_SECTION, CATERING_MARKUP, 100, 0);
    expect(items).toHaveLength(1);
  });
});

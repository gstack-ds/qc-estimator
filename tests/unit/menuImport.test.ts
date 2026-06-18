import { describe, it, expect } from 'vitest';
import { mapMenuToLineItems, mapBarToLineItems, collapseFoodMenuToLine } from '../../src/lib/vendors/menuImport';
import type { MenuImportSection, MenuImportMarkup } from '../../src/lib/vendors/menuImport';
import { computeBarPricePP } from '../../src/lib/vendors/profileTypes';
import type { VendorMenu, BarOption } from '../../src/lib/vendors/profileTypes';
import { vendorMenuToMenuCourses, parseMaxSelections } from '../../src/lib/slideCopy/vendorProfileMapping';
import { extractedMenuToMenuCourses } from '../../src/lib/slideCopy/menuMapping';
import type { ExtractedMenuItem } from '../../src/app/(programs)/programs/[id]/estimates/actions';

const FB_SECTION: MenuImportSection = { id: 'section-fb-1', name: 'Food & Beverage', taxBucket: 'fb', markupPct: 0.55 };
const CATERING_MARKUP: MenuImportMarkup = { id: 'markup-catering-1', markupPct: 0.55 };
const GUEST_COUNT = 80;

// ─── A menu imports as ONE line (priced) ──────────────────

describe('menu with price_per_person', () => {
  const menu: VendorMenu = {
    id: 'm1', name: 'Gold Package', price_per_person: 95,
    courses: [{ id: 'c1', name: 'Appetizers', items: [{ id: 'i1', name: 'Bruschetta' }, { id: 'i2', name: 'Shrimp Cocktail', price: 12 }] }],
  };

  it('returns exactly one line item — the menu, not its dishes', () => {
    expect(mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0)).toHaveLength(1);
  });
  it('uses menu name, price_per_person, guest count, food tax, section, markup', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 5);
    expect(item.name).toBe('Gold Package');
    expect(item.unitPrice).toBe(95);
    expect(item.qty).toBe(GUEST_COUNT);
    expect(item.taxType).toBe('food');
    expect(item.sectionId).toBe('section-fb-1');
    expect(item.section).toBe('Food & Beverage');
    expect(item.taxBucket).toBe('fb');
    expect(item.categoryId).toBe('markup-catering-1');
    expect(item.categoryMarkupPct).toBe(0.55);
    expect(item.isNew).toBe(true);
    expect(item.sortOrder).toBe(5);
  });
});

// ─── A no-price multi-course menu STILL imports as ONE line (the bug fix) ──────

describe('menu without price_per_person — one line, never per-dish', () => {
  const menu: VendorMenu = {
    id: 'm2', name: 'Family-Style Dinner',
    courses: [
      { id: 'c1', name: 'Mains', items: [{ id: 'i1', name: 'Chicken', price: 28 }, { id: 'i2', name: 'Salmon', price: 35 }] },
      { id: 'c2', name: 'Desserts', items: [{ id: 'i3', name: 'Cheesecake', price: 10 }] },
    ],
  };

  it('returns ONE line for the whole menu (not one per dish)', () => {
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Family-Style Dinner');
  });
  it('unitPrice is 0 when the menu has no per-person price (for the planner to fill)', () => {
    const [item] = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(item.unitPrice).toBe(0);
  });
});

describe('menu with no courses at all', () => {
  it('returns one line using the menu name', () => {
    const menu: VendorMenu = { id: 'm4', name: 'Custom Menu', courses: [] };
    const result = mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Custom Menu');
    expect(result[0].unitPrice).toBe(0);
  });
});

describe('markup with null categoryId / guest counts', () => {
  it('passes null categoryId through', () => {
    const menu: VendorMenu = { id: 'm5', name: 'Simple', price_per_person: 50, courses: [] };
    const [item] = mapMenuToLineItems(menu, FB_SECTION, { id: null, markupPct: 0.55 }, GUEST_COUNT, 0);
    expect(item.categoryId).toBeNull();
  });
  it('uses the provided guest count for qty', () => {
    const menu: VendorMenu = { id: 'm6', name: 'Dinner', price_per_person: 100, courses: [] };
    expect(mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, 120, 0)[0].qty).toBe(120);
  });
});

describe('menu name price-text stripping', () => {
  it('strips a price suffix from the menu name', () => {
    const menu: VendorMenu = { id: 'm-p', name: 'Gold Package - $95 per person', price_per_person: 95, courses: [] };
    expect(mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, 80, 0)[0].name).toBe('Gold Package');
  });
  it('leaves a clean menu name unchanged', () => {
    const menu: VendorMenu = { id: 'm-p2', name: 'Breakfast Package', price_per_person: 45, courses: [] };
    expect(mapMenuToLineItems(menu, FB_SECTION, CATERING_MARKUP, 50, 0)[0].name).toBe('Breakfast Package');
  });
});

// ─── collapseFoodMenuToLine — attachment "Populate Line Items" path ───────────

describe('collapseFoodMenuToLine', () => {
  it('collapses many food items into one line', () => {
    const item = collapseFoodMenuToLine(
      [{ name: 'Charcuterie', pricePerPerson: 0 }, { name: 'Salad', pricePerPerson: 0 }, { name: 'Entrées', pricePerPerson: 0 }],
      'Plated Menu', FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 2,
    );
    expect(item.name).toBe('Plated Menu');
    expect(item.qty).toBe(GUEST_COUNT);
    expect(item.taxType).toBe('food');
    expect(item.sortOrder).toBe(2);
    expect(item.unitPrice).toBe(0);
  });
  it('uses the highest per-person price found among the items', () => {
    const item = collapseFoodMenuToLine(
      [{ name: 'A', pricePerPerson: 0 }, { name: 'B', pricePerPerson: 120 }, { name: 'C', pricePerPerson: 95 }],
      'Plated Menu', FB_SECTION, CATERING_MARKUP, GUEST_COUNT, 0,
    );
    expect(item.unitPrice).toBe(120);
  });
});

// ─── parseMaxSelections ───────────────────────────────────

describe('parseMaxSelections', () => {
  it('parses digits and number words; defaults a ruled course to 1', () => {
    expect(parseMaxSelections('choose 3')).toBe(3);
    expect(parseMaxSelections('please choose one')).toBe(1);
    expect(parseMaxSelections('select two')).toBe(2);
    expect(parseMaxSelections('choose')).toBe(1);
    expect(parseMaxSelections(undefined)).toBeUndefined();
  });
});

// ─── Old Vinings "Carousel President's Dinner" — the live-bug fixture ──────────
// Structure mirrors tests/fixtures/2027-05-11_Defore_Presidents_PacesMenu.pdf:
// one prix-fixe family-style menu, no printed price, with a "please choose one" entrée course.

const OLD_VININGS: VendorMenu = {
  id: 'ov', name: "Carousel President's Dinner",
  courses: [
    { id: 'app', name: 'Appetizer', items: [{ id: 'a1', name: 'Charcuterie Boards' }] },
    { id: 'sal', name: 'Salad', items: [{ id: 's1', name: 'Artisan Greens' }] },
    { id: 'ent', name: 'Entrees', selection_rule: 'please choose one', items: [
      { id: 'e1', name: 'Springer Mountain Buttermilk Fried Chicken Breast' },
      { id: 'e2', name: 'Market Fish' },
      { id: 'e3', name: 'Signature Crab Cakes' },
      { id: 'e4', name: 'Grilled Beef Tenderloin Medallions' },
      { id: 'e5', name: 'Vegetable Spaghetti', dietary_tags: ['V', 'VG'] },
    ] },
    { id: 'acc', name: 'Accoutrements', items: [{ id: 'ac1', name: 'Whipped Potatoes and Seasonal Vegetables' }] },
    { id: 'des', name: 'Desserts', items: [
      { id: 'd1', name: 'Seasonal Fruit Cobbler' },
      { id: 'd2', name: 'Flourless Chocolate Torte' },
    ] },
  ],
};

describe("Old Vinings prix-fixe menu — ONE line + menu detail (not ~10 lines)", () => {
  it('imports as exactly ONE estimate line item', () => {
    const result = mapMenuToLineItems(OLD_VININGS, FB_SECTION, CATERING_MARKUP, 80, 0);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Carousel President's Dinner");
    expect(result[0].unitPrice).toBe(0); // no printed price → blank for the planner
    expect(result[0].taxType).toBe('food');
    expect(result[0].qty).toBe(80);
  });

  it('populates the full menu detail as menuSelections', () => {
    const courses = vendorMenuToMenuCourses(OLD_VININGS);
    expect(courses).toHaveLength(5);

    const entrees = courses.find((c) => c.name === 'Entrees')!;
    expect(entrees.scenario).toBe('needs_selection');
    expect(entrees.maxSelections).toBe(1); // "please choose one"
    expect(entrees.options).toHaveLength(5);

    const veg = entrees.options.find((o) => o.name === 'Vegetable Spaghetti')!;
    expect(veg.tags).toEqual(['V', 'VG']);

    // Family-style courses are served (no client choice).
    for (const name of ['Appetizer', 'Salad', 'Accoutrements', 'Desserts']) {
      expect(courses.find((c) => c.name === name)!.scenario).toBe('final');
    }
  });
});

// ─── Path B detail mapping (attachment extraction) — Old Vinings shape ────────
// extractedMenuToMenuCourses must derive maxSelections=1 from "please choose one" even when
// the extractor didn't emit a maxSelections field.

describe('extractedMenuToMenuCourses — attachment menu detail', () => {
  const extracted: ExtractedMenuItem[] = [
    { name: 'Charcuterie Boards', category: 'food', pricePerPerson: 0, needsSelection: false, selections: ['Charcuterie Boards'] },
    {
      name: 'Entrees', category: 'food', pricePerPerson: 0, needsSelection: true, selectionRule: 'please choose one',
      options: [
        { name: 'Springer Mountain Buttermilk Fried Chicken Breast' },
        { name: 'Market Fish' },
        { name: 'Signature Crab Cakes' },
        { name: 'Grilled Beef Tenderloin Medallions' },
        { name: 'Vegetable Spaghetti', tags: ['V', 'VG'] },
      ],
    },
  ];

  it('derives maxSelections=1 for a "please choose one" course with no explicit count', () => {
    const courses = extractedMenuToMenuCourses(extracted);
    const entrees = courses.find((c) => c.name === 'Entrees')!;
    expect(entrees.scenario).toBe('needs_selection');
    expect(entrees.maxSelections).toBe(1);
    expect(entrees.options).toHaveLength(5);
    expect(entrees.options.find((o) => o.name === 'Vegetable Spaghetti')!.tags).toEqual(['V', 'VG']);
    expect(courses.find((c) => c.name === 'Charcuterie Boards')!.scenario).toBe('final');
  });
});

// ─── computeBarPricePP + mapBarToLineItems (unchanged behavior) ───────────────

const BAR_SIMPLE: BarOption = { id: 'b1', name: 'House Bar', price_per_person: 40, categories: [] };
const BAR_DURATION: BarOption = { id: 'b2', name: 'Premium Open Bar', price_per_person: 45, base_hours: 2, additional_hour_price_per_person: 12, categories: [] };

describe('computeBarPricePP', () => {
  it('returns price_per_person when no/!null duration', () => {
    expect(computeBarPricePP(BAR_SIMPLE)).toBe(40);
    expect(computeBarPricePP(BAR_DURATION, null)).toBe(45);
  });
  it('adds extra hours beyond base_hours', () => {
    expect(computeBarPricePP(BAR_DURATION, 3)).toBe(57);
    expect(computeBarPricePP(BAR_DURATION, 2.5)).toBe(51);
  });
  it('returns 0 when price_per_person is 0', () => {
    expect(computeBarPricePP({ id: 'b3', name: 'Comp', price_per_person: 0, categories: [] }, 4)).toBe(0);
  });
});

describe('mapBarToLineItems', () => {
  it('creates a single alcohol line item', () => {
    const items = mapBarToLineItems(BAR_SIMPLE, null, FB_SECTION, CATERING_MARKUP, 100, 0);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('House Bar');
    expect(items[0].taxType).toBe('alcohol');
    expect(items[0].unitPrice).toBe(40);
  });
  it('applies duration pricing and strips price text from the name', () => {
    const [item] = mapBarToLineItems(BAR_DURATION, 4, FB_SECTION, CATERING_MARKUP, 50, 0);
    expect(item.unitPrice).toBe(69);
    const [stripped] = mapBarToLineItems({ id: 'bp', name: 'Open Bar - $55 Per Person', price_per_person: 55, categories: [] }, null, FB_SECTION, CATERING_MARKUP, 50, 0);
    expect(stripped.name).toBe('Open Bar');
  });
});

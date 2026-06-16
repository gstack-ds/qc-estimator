import { describe, it, expect } from 'vitest';
import { vendorMenuToMenuCourses } from '../../src/lib/slideCopy/vendorProfileMapping';
import { extractedMenuToMenuCourses } from '../../src/lib/slideCopy/menuMapping';
import type { VendorMenu } from '../../src/lib/vendors/profileTypes';
import type { MenuCourse } from '../../src/types/slideCopy';

// LEAK CONSTRAINT (non-negotiable): menu detail reaches a client surface ONLY through the
// menuSelections channel (MenuCourse[]), which must be structurally PRICE-FREE — dish names,
// dietary tags, descriptions, selection rules only. NO our-cost, vendor cost, per-person price,
// or price-tier name ("$85 Per Person") may ride along. These tests prove a menu carrying prices
// at every level still maps to menuSelections with zero price/cost data.

// A vendor menu loaded with prices at every level (menu tier price, course items with prices).
const PRICED_MENU: VendorMenu = {
  id: 'm1',
  name: '$85 Per Person Plated Dinner', // price-tier name — internal, must NOT surface
  price_per_person: 85,
  description: 'Three-course plated dinner',
  courses: [
    {
      id: 'c1',
      name: 'First Course',
      selection_rule: 'choose 1',
      items: [
        { id: 'i1', name: 'Burrata', description: 'heirloom tomato', dietary_tags: ['V', 'GF'], price: 18 },
        { id: 'i2', name: 'Tuna Crudo', dietary_tags: ['GF', 'DF'], price: 22 },
      ],
    },
    {
      id: 'c2',
      name: 'Entrée',
      items: [
        { id: 'i3', name: 'Filet Mignon', dietary_tags: ['GF'], price: 65 },
        { id: 'i4', name: 'Roasted Cauliflower Steak', dietary_tags: ['V', 'VG', 'GF', 'NF'], price: 42 },
      ],
    },
  ],
};

// Keys that would indicate a price/cost leaked into the client menu channel.
const PRICE_KEYS = ['price', 'pricePerPerson', 'price_per_person', 'unitPrice', 'unit_price', 'cost', 'ourCost', 'clientCost', 'markup'];

function deepKeys(obj: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(obj)) { obj.forEach((v) => deepKeys(v, acc)); return acc; }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) { acc.add(k); deepKeys(v, acc); }
  }
  return acc;
}

function assertPriceFree(courses: MenuCourse[]) {
  const keys = deepKeys(courses);
  for (const pk of PRICE_KEYS) {
    expect(keys.has(pk), `menuSelections must not contain a "${pk}" field`).toBe(false);
  }
  // No "$<digits>" price text anywhere (dish names/tags/rules are price-free; maxSelections,
  // a legitimate "choose N" count, is allowed — the concern is money, not all numbers).
  const json = JSON.stringify(courses);
  expect(/\$\s?\d/.test(json), 'menuSelections must contain no "$<digits>" price text').toBe(false);
}

describe('menu→client leak boundary: vendorMenuToMenuCourses', () => {
  const courses = vendorMenuToMenuCourses(PRICED_MENU);

  it('carries dish names, dietary tags, descriptions, and selection rules', () => {
    expect(courses).toHaveLength(2);
    expect(courses[0].name).toBe('First Course');
    expect(courses[0].selectionRule).toBe('choose 1');
    expect(courses[0].scenario).toBe('needs_selection');
    const burrata = courses[0].options.find((o) => o.name === 'Burrata');
    expect(burrata?.tags).toEqual(['V', 'GF']);
    expect(burrata?.description).toBe('heirloom tomato');
    expect(courses[1].options.find((o) => o.name === 'Roasted Cauliflower Steak')?.tags)
      .toEqual(['V', 'VG', 'GF', 'NF']);
  });

  it('produces ZERO price/cost data even though the source menu is fully priced', () => {
    assertPriceFree(courses);
  });

  it('never surfaces the price-tier name ("$85 Per Person ...") — uses course/dish names only', () => {
    const json = JSON.stringify(courses);
    expect(json).not.toContain('$85');
    expect(json).not.toContain('Per Person');
    expect(json.toLowerCase()).not.toContain('per person');
  });
});

describe('menu→client leak boundary: extractedMenuToMenuCourses', () => {
  it('produces zero price/cost data from priced extraction items', () => {
    const courses = extractedMenuToMenuCourses([
      { name: 'Plated Dinner', pricePerPerson: 85, category: 'food', tags: ['GF'], selections: ['Filet', 'Salmon'] },
      {
        name: 'Packages', category: 'food', pricePerPerson: 0,
        packageOptions: { label: 'Dinner Package', options: [
          { id: 'a', name: 'Silver', pricePerPerson: 70, items: ['Salad', 'Chicken'] },
          { id: 'b', name: 'Gold', pricePerPerson: 95, items: ['Salad', 'Filet'] },
        ] },
      },
    ]);
    assertPriceFree(courses);
    // package names carry (client-safe), prices do not
    const json = JSON.stringify(courses);
    expect(json).toContain('Silver');
    expect(json).not.toContain('70');
    expect(json).not.toContain('95');
  });
});

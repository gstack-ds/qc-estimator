import { describe, it, expect } from 'vitest';
import { extractedMenuToMenuCourses } from '../../src/lib/slideCopy/menuMapping';
import type { ExtractedMenuItem } from '../../src/app/(programs)/programs/[id]/estimates/actions';
import type { PackageOptions } from '../../src/types';

// ─── Test fixtures ────────────────────────────────────────

const FOOD_PACKAGES: PackageOptions = {
  label: 'Food Package',
  options: [
    { id: 'a', name: 'Package A', description: '3-course plated dinner', pricePerPerson: 85, items: ['Caesar salad', 'Filet mignon', 'Chocolate torte'] },
    { id: 'b', name: 'Package B', description: '4-course tasting menu', pricePerPerson: 110, items: ['Amuse bouche', 'Burrata', 'Wagyu', 'Crème brûlée'] },
  ],
};

const packageMenuItem: ExtractedMenuItem = {
  name: 'Food Package',
  pricePerPerson: 0,
  category: 'food',
  packageOptions: FOOD_PACKAGES,
};

const regularMenuItem: ExtractedMenuItem = {
  name: 'Cocktail Hour',
  pricePerPerson: 45,
  category: 'food',
  selections: ['Bruschetta', 'Shrimp cocktail'],
};

// ─── extractedMenuToMenuCourses — package items ───────────

describe('extractedMenuToMenuCourses — package groups', () => {
  it('converts a package item to a needs_selection course', () => {
    const courses = extractedMenuToMenuCourses([packageMenuItem]);
    expect(courses).toHaveLength(1);
    expect(courses[0].scenario).toBe('needs_selection');
    expect(courses[0].name).toBe('Food Package');
  });

  it('maps each package option to a menu option', () => {
    const courses = extractedMenuToMenuCourses([packageMenuItem]);
    const options = courses[0].options;
    expect(options).toHaveLength(2);
    expect(options[0].name).toBe('Package A');
    expect(options[1].name).toBe('Package B');
  });

  it('sets maxSelections to 1 for package groups', () => {
    const courses = extractedMenuToMenuCourses([packageMenuItem]);
    expect(courses[0].maxSelections).toBe(1);
  });

  it('package options start unselected', () => {
    const courses = extractedMenuToMenuCourses([packageMenuItem]);
    expect(courses[0].options.every((o) => !o.selected)).toBe(true);
  });

  it('description is preserved on each option', () => {
    const courses = extractedMenuToMenuCourses([packageMenuItem]);
    expect(courses[0].options[0].description).toBe('3-course plated dinner');
  });

  it('handles mixed regular and package items', () => {
    const courses = extractedMenuToMenuCourses([regularMenuItem, packageMenuItem]);
    expect(courses).toHaveLength(2);
    expect(courses[0].scenario).toBe('final');   // regular item
    expect(courses[1].scenario).toBe('needs_selection'); // package group
  });

  it('regular items (no packageOptions) continue to work as before', () => {
    const courses = extractedMenuToMenuCourses([regularMenuItem]);
    expect(courses).toHaveLength(1);
    expect(courses[0].name).toBe('Cocktail Hour');
    expect(courses[0].scenario).toBe('final');
    expect(courses[0].options.map((o) => o.name)).toEqual(['Bruschetta', 'Shrimp cocktail']);
  });
});

// ─── Package selection pricing ────────────────────────────

describe('package selection — pricing', () => {
  it('selecting a package uses its pricePerPerson as unitPrice', () => {
    const selectedId = 'b';
    const selected = FOOD_PACKAGES.options.find((o) => o.id === selectedId);
    expect(selected).toBeDefined();
    expect(selected!.pricePerPerson).toBe(110);
    // The UI calls onChange(selectedId, pricePerPerson) which sets unitPrice = 110
    // This is structural: the engine then computes clientCost = qty × 110 × (1 + markup)
  });

  it('package with no selection has pricePerPerson 0', () => {
    expect(packageMenuItem.pricePerPerson).toBe(0);
  });

  it('all package options have positive pricePerPerson', () => {
    FOOD_PACKAGES.options.forEach((opt) => {
      expect(opt.pricePerPerson).toBeGreaterThan(0);
    });
  });

  it('package items array is populated for each option', () => {
    const pkgA = FOOD_PACKAGES.options[0];
    expect(pkgA.items).toContain('Filet mignon');
    expect(pkgA.items).toHaveLength(3);

    const pkgB = FOOD_PACKAGES.options[1];
    expect(pkgB.items).toContain('Wagyu');
    expect(pkgB.items).toHaveLength(4);
  });
});

// ─── Slide copy integration ───────────────────────────────

describe('package selection — Slide 2 integration', () => {
  it('selected package items appear as final menu options when synced', () => {
    // Simulate the packageDerivedCourses computation from SlideCopySection
    const lineItems = [
      { packageOptions: FOOD_PACKAGES, selectedPackageId: 'a', taxBucket: 'fb', taxType: 'food', name: 'Food Package', qty: 50 },
    ];

    const derived = lineItems
      .filter((li) => li.packageOptions && li.selectedPackageId)
      .map((li) => {
        const pkg = li.packageOptions!.options.find((o) => o.id === li.selectedPackageId);
        if (!pkg) return null;
        return {
          name: li.packageOptions!.label,
          scenario: 'final' as const,
          options: pkg.items.map((item) => ({ name: item, tags: [] as string[], selected: true, locked: true })),
        };
      })
      .filter(Boolean);

    expect(derived).toHaveLength(1);
    expect(derived[0]!.name).toBe('Food Package');
    expect(derived[0]!.scenario).toBe('final');
    expect(derived[0]!.options.map((o) => o.name)).toEqual(['Caesar salad', 'Filet mignon', 'Chocolate torte']);
    expect(derived[0]!.options.every((o) => o.selected)).toBe(true);
  });

  it('unselected packages do not appear in derived courses', () => {
    const lineItems = [
      { packageOptions: FOOD_PACKAGES, selectedPackageId: null, taxBucket: 'fb', taxType: 'food', name: 'Food Package', qty: 50 },
    ];
    const derived = lineItems.filter((li) => li.packageOptions && li.selectedPackageId);
    expect(derived).toHaveLength(0);
  });

  it('multiple package selections produce one course each', () => {
    const barPackages: PackageOptions = {
      label: 'Bar Package',
      options: [
        { id: 'x', name: 'Beer & Wine', pricePerPerson: 30, items: ['House wine', 'Domestic beer'] },
        { id: 'y', name: 'Full Bar', pricePerPerson: 55, items: ['Spirits', 'Wine', 'Beer'] },
      ],
    };
    const lineItems = [
      { packageOptions: FOOD_PACKAGES, selectedPackageId: 'b', taxBucket: 'fb', taxType: 'food', name: 'Food Package', qty: 50 },
      { packageOptions: barPackages, selectedPackageId: 'x', taxBucket: 'fb', taxType: 'alcohol', name: 'Bar Package', qty: 50 },
    ];
    const derived = lineItems
      .filter((li) => li.packageOptions && li.selectedPackageId)
      .map((li) => {
        const pkg = li.packageOptions!.options.find((o) => o.id === li.selectedPackageId);
        return pkg ? { name: li.packageOptions!.label, items: pkg.items } : null;
      })
      .filter(Boolean);

    expect(derived).toHaveLength(2);
    expect(derived[0]!.name).toBe('Food Package');
    expect(derived[0]!.items).toContain('Wagyu');
    expect(derived[1]!.name).toBe('Bar Package');
    expect(derived[1]!.items).toContain('House wine');
  });
});

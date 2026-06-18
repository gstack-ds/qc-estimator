// Transforms vendor profile data (Phase 2) → Slide Copy editable fields.
// Pure functions: no React, no server imports, safe to use anywhere.

import type { VendorMenu, BarOption, VendorInclusion } from '@/lib/vendors/profileTypes';
import { computeBarPricePP } from '@/lib/vendors/profileTypes';
import type { MenuCourse, MenuOption } from '@/types/slideCopy';

// ── Menu → MenuCourse[] ───────────────────────────────────────────────────────
// Converts a stored VendorMenu into the MenuCourse[] format used by SlideCopySection.
// Courses with a selection_rule become 'needs_selection'; others become 'final'.

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// Parse the count from a course selection rule: "choose 3" → 3, "please choose one" → 1.
// A selection rule with no explicit number defaults to 1 (the "choose one" case).
export function parseMaxSelections(rule?: string): number | undefined {
  if (!rule) return undefined;
  const digit = rule.match(/\d+/);
  if (digit) return parseInt(digit[0], 10);
  const lower = rule.toLowerCase();
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return n;
  }
  return 1;
}

export function vendorMenuToMenuCourses(menu: VendorMenu): MenuCourse[] {
  return menu.courses.map((course): MenuCourse => {
    const hasSelection = !!course.selection_rule;
    const options: MenuOption[] = course.items.map((item): MenuOption => ({
      name: item.name,
      description: item.description,
      tags: item.dietary_tags ? [...item.dietary_tags] : [],
      selected: !hasSelection,
      locked: !hasSelection,
    }));
    return {
      name: course.name,
      selectionRule: course.selection_rule,
      maxSelections: hasSelection ? parseMaxSelections(course.selection_rule) : undefined,
      scenario: hasSelection ? 'needs_selection' : 'final',
      options,
    };
  });
}

// ── BarOption → bar notes text ────────────────────────────────────────────────
// Produces the free-text format used in SlideCopySection's barNotes field.
// Format mirrors the Dianthus/SPIN template: CATEGORY: Brand1, Brand2

export function vendorBarToBarNotes(barOption: BarOption, durationHours?: number | null): string {
  const lines: string[] = [barOption.name.toUpperCase()];
  const pricePP = computeBarPricePP(barOption, durationHours);
  if (pricePP > 0) {
    if (durationHours != null && barOption.base_hours != null && barOption.additional_hour_price_per_person != null) {
      lines.push(`$${pricePP}/pp (${durationHours} hrs)`);
    } else if (barOption.price_per_person != null) {
      lines.push(`$${barOption.price_per_person} per person`);
    }
  } else if (barOption.price_per_person != null) {
    lines.push(`$${barOption.price_per_person} per person`);
  }
  if (barOption.description) {
    lines.push('', barOption.description);
  }
  if (barOption.categories.length > 0) {
    lines.push('');
    for (const cat of barOption.categories) {
      if (cat.brands.length > 0) {
        lines.push(`${cat.name.toUpperCase()}: ${cat.brands.join(', ')}`);
      } else {
        lines.push(cat.name.toUpperCase());
      }
    }
  }
  if (barOption.notes) {
    lines.push('', barOption.notes);
  }
  return lines.join('\n').trim();
}

// ── Inclusions → plain text ───────────────────────────────────────────────────
// Joins vendor inclusions as a newline-separated string suitable for
// the customInclusion field in InclusionToggles.

export function vendorInclusionsToText(inclusions: VendorInclusion[]): string {
  return inclusions.map((i) => i.text).join('\n');
}

// ── Space capacity → banner string ───────────────────────────────────────────
// Formats space capacity fields into the maxCapacity banner string.
// E.g. "Rooftop: 150 Seated / 250 Standing"

export function formatCapacityBanner(
  seated: number | null | undefined,
  standing: number | null | undefined,
  spaceName?: string | null,
): string {
  const parts: string[] = [];
  if (seated != null) parts.push(`${seated} Seated`);
  if (standing != null) parts.push(`${standing} Standing`);
  const capacity = parts.join(' / ');
  if (!capacity) return '';
  return spaceName ? `${spaceName}: ${capacity}` : capacity;
}

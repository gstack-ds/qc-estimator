// Pure functions: map vendor profile data to importable line items.
// No React/Next/Supabase deps — fully testable.

import type { VendorMenu, BarOption } from './profileTypes';
import { computeBarPricePP } from './profileTypes';
import type { TaxBucket, TaxType } from '@/types';

export interface MenuImportSection {
  id: string;
  name: string;
  taxBucket: TaxBucket;
  markupPct: number;
}

export interface MenuImportMarkup {
  id: string | null;
  markupPct: number;
}

// Shape compatible with LocalLineItem (structural typing — no circular import needed)
export interface MenuLineItem {
  id: string;
  sectionId: string;
  section: string;
  taxBucket: TaxBucket;
  name: string;
  qty: number;
  unitPrice: number;
  categoryId: string | null;
  defaultMarkupPct: number;
  categoryMarkupPct: number;
  taxType: TaxType;
  sortOrder: number;
  isNew: true;
}

/**
 * Maps a VendorMenu to a list of line items for import into an estimate.
 *
 * Rules:
 * - If menu has price_per_person → ONE line item (the whole menu at that per-person price)
 * - If no menu price_per_person → one line item per course item (priced at item.price ?? 0)
 *   If there are no items at all → one $0 line item using the menu name
 * - qty = guestCount for all items
 * - taxType = 'food' (all menus are F&B)
 */
export function mapMenuToLineItems(
  menu: VendorMenu,
  section: MenuImportSection,
  markup: MenuImportMarkup,
  guestCount: number,
  startSortOrder: number,
): MenuLineItem[] {
  const items: MenuLineItem[] = [];
  let order = startSortOrder;

  function makeItem(name: string, unitPrice: number): MenuLineItem {
    return {
      id: `menu-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sectionId: section.id,
      section: section.name,
      taxBucket: section.taxBucket,
      name,
      qty: guestCount,
      unitPrice,
      categoryId: markup.id,
      defaultMarkupPct: markup.markupPct,
      categoryMarkupPct: markup.markupPct,
      taxType: 'food',
      sortOrder: order++,
      isNew: true,
    };
  }

  if (menu.price_per_person != null) {
    items.push(makeItem(menu.name, menu.price_per_person));
    return items;
  }

  // No menu-level price — flatten all course items
  for (const course of menu.courses) {
    for (const item of course.items) {
      items.push(makeItem(item.name, item.price ?? 0));
    }
  }

  // Fallback: no items at all
  if (items.length === 0) {
    items.push(makeItem(menu.name, 0));
  }

  return items;
}

/**
 * Maps a BarOption to a single importable line item.
 *
 * - unitPrice = computeBarPricePP(opt, durationHours) — handles base + extra-hour pricing
 * - taxType = 'alcohol'
 * - qty = guestCount
 */
export function mapBarToLineItems(
  opt: BarOption,
  durationHours: number | null,
  section: MenuImportSection,
  markup: MenuImportMarkup,
  guestCount: number,
  startSortOrder: number,
): MenuLineItem[] {
  const pricePP = computeBarPricePP(opt, durationHours);
  return [{
    id: `bar-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sectionId: section.id,
    section: section.name,
    taxBucket: section.taxBucket,
    name: opt.name,
    qty: guestCount,
    unitPrice: pricePP,
    categoryId: markup.id,
    defaultMarkupPct: markup.markupPct,
    categoryMarkupPct: markup.markupPct,
    taxType: 'alcohol' as TaxType,
    sortOrder: startSortOrder,
    isNew: true as const,
  }];
}

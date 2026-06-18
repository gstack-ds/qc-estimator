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

// Strip trailing price text from item/menu names before using them as line item names.
// Prices belong only in the cost field, not in client-facing descriptions.
// Handles: "- $30 Per Person", " $30/pp", " ($45)", " $25", etc.
function stripPriceText(s: string): string {
  return s.replace(/\s*[-–—(]?\s*\$[\d,]+(?:\.\d+)?(?:\s*(?:per\s+person?|\/pp?\b|p\.p\.|each))?\s*\)?\s*$/i, '').trim();
}

function buildMenuLineItem(
  name: string,
  unitPrice: number,
  section: MenuImportSection,
  markup: MenuImportMarkup,
  guestCount: number,
  sortOrder: number,
): MenuLineItem {
  return {
    id: `menu-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sectionId: section.id,
    section: section.name,
    taxBucket: section.taxBucket,
    name: stripPriceText(name),
    qty: guestCount,
    unitPrice,
    categoryId: markup.id,
    defaultMarkupPct: markup.markupPct,
    categoryMarkupPct: markup.markupPct,
    taxType: 'food',
    sortOrder,
    isNew: true,
  };
}

/**
 * Maps a VendorMenu to line items for import into an estimate.
 *
 * A menu ALWAYS imports as exactly ONE line item — the whole menu. The dishes/courses are
 * menu DETAIL (the menuSelections channel), never separate billable line items.
 * unitPrice = the menu's per-person price, or 0 when the menu has none (e.g. a prix-fixe PDF
 * with no printed price) for the planner to fill in. qty = guestCount, taxType = 'food'.
 */
export function mapMenuToLineItems(
  menu: VendorMenu,
  section: MenuImportSection,
  markup: MenuImportMarkup,
  guestCount: number,
  startSortOrder: number,
): MenuLineItem[] {
  return [buildMenuLineItem(menu.name, menu.price_per_person ?? 0, section, markup, guestCount, startSortOrder)];
}

/**
 * Collapses extracted food menu items (the parsed courses/dishes of ONE menu) into a single
 * line item — used by the attachment "Populate Line Items" path so a multi-course menu PDF
 * imports as one menu line, not one line per dish. unitPrice = the highest per-person price
 * found among the items (a prix-fixe price often rides on one course), else 0.
 */
export function collapseFoodMenuToLine(
  foodItems: { name?: string; pricePerPerson?: number | null }[],
  menuName: string,
  section: MenuImportSection,
  markup: MenuImportMarkup,
  guestCount: number,
  sortOrder: number,
): MenuLineItem {
  const unitPrice = foodItems.reduce((max, i) => Math.max(max, i.pricePerPerson ?? 0), 0);
  return buildMenuLineItem(menuName, unitPrice, section, markup, guestCount, sortOrder);
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
    name: stripPriceText(opt.name),
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

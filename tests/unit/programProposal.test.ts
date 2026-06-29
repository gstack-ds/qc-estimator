import { describe, it, expect } from 'vitest';
import {
  estimateTax,
  computeProgramGrandTotal,
  effectiveLocation,
  rawLineItemToExportItem,
  type RawLineItemRow,
} from '../../src/lib/proposals/programProposal';
import { groupLineItemsBySections } from '../../src/lib/utils/export';
import type { EstimateSummary, Location } from '../../src/types';

function makeSummary(overrides: Partial<EstimateSummary> = {}): EstimateSummary {
  return {
    fbSubtotalOur: 0, fbSubtotalClient: 0, fbFoodSubtotalClient: 0, fbAlcoholSubtotalClient: 0,
    foodTax: 0, alcoholTax: 0,
    equipmentSubtotalOur: 0, equipmentSubtotalClient: 0, equipmentTax: 0,
    qcStaffingSubtotalOur: 0, qcStaffingSubtotalClient: 0,
    venueSubtotalOur: 0, venueSubtotalClient: 0, venueTax: 0,
    serviceChargeOur: 0, serviceChargeClient: 0, gratuityOur: 0, gratuityClient: 0,
    adminFeeOur: 0, adminFeeClient: 0,
    subtotalOur: 0, subtotalClient: 0,
    productionFee: 0, productionFeeTax: 0,
    lineItemsSubtotalClient: 0, preTaxTotal: 0,
    totalOur: 0, totalClient: 0,
    vendorTaxesTotal: 0, revenueItemsClientTotal: 0,
    pricePerPerson: 0, fbMinimumMet: true, fbShortfall: 0,
    discountAmount: 0, eegCommissionAmount: 0, travelInProductionFee: 0,
    ...overrides,
  };
}

const LOCATION: Location = {
  id: 'loc', name: 'Charlotte, NC', foodTaxRate: 0.08, alcoholTaxRate: 0.08, generalTaxRate: 0.0725,
} as Location;

describe('estimateTax', () => {
  it('sums an estimate\'s own tax components only', () => {
    const s = makeSummary({ foodTax: 10, alcoholTax: 5, equipmentTax: 20, venueTax: 3, productionFeeTax: 2 });
    expect(estimateTax(s)).toBeCloseTo(40);
  });
});

describe('computeProgramGrandTotal', () => {
  // Estimate A — general-tax only
  const a = makeSummary({
    lineItemsSubtotalClient: 1000, productionFee: 100, preTaxTotal: 1100,
    equipmentTax: 80, discountAmount: 0, eegCommissionAmount: 0, totalClient: 1180,
  });
  // Estimate B — DIFFERENT tax jurisdiction (food + alcohol), plus discount and EEG on
  const b = makeSummary({
    lineItemsSubtotalClient: 2000, productionFee: 200, preTaxTotal: 2200,
    foodTax: 120, alcoholTax: 30, discountAmount: 50, eegCommissionAmount: 220, totalClient: 2520,
  });

  it('sums pre-tax totals, taxes, commissions, and finals across estimates', () => {
    const g = computeProgramGrandTotal([a, b]);
    expect(g.subtotal).toBeCloseTo(3000);
    expect(g.productionFee).toBeCloseTo(300);
    expect(g.preTaxTotal).toBeCloseTo(3300);
    expect(g.tax).toBeCloseTo(230);          // 80 + 150 — each estimate's own jurisdiction
    expect(g.discountAmount).toBeCloseTo(50);
    expect(g.eegCommissionAmount).toBeCloseTo(220);
    expect(g.total).toBeCloseTo(3700);
  });

  it('grand total reconciles: total = preTaxTotal + tax − discount + eeg', () => {
    const g = computeProgramGrandTotal([a, b]);
    expect(g.total).toBeCloseTo(g.preTaxTotal + g.tax - g.discountAmount + g.eegCommissionAmount);
  });

  it('does not blend tax across jurisdictions — it is a straight sum of each estimate\'s tax', () => {
    const g = computeProgramGrandTotal([a, b]);
    expect(g.tax).toBeCloseTo(estimateTax(a) + estimateTax(b));
  });

  it('excluding an estimate removes exactly its contribution (deselect)', () => {
    const all = computeProgramGrandTotal([a, b]);
    const onlyA = computeProgramGrandTotal([a]);
    expect(all.total - onlyA.total).toBeCloseTo(b.totalClient);
    expect(onlyA.total).toBeCloseTo(a.totalClient);
  });

  it('is order-independent for the grand total (reorder does not change sums)', () => {
    expect(computeProgramGrandTotal([a, b]).total).toBeCloseTo(computeProgramGrandTotal([b, a]).total);
  });

  it('empty selection yields all zeros', () => {
    const g = computeProgramGrandTotal([]);
    expect(g.total).toBe(0);
    expect(g.tax).toBe(0);
  });
});

describe('effectiveLocation', () => {
  it('applies per-estimate tax overrides over the program location', () => {
    const eff = effectiveLocation(LOCATION, { general_tax_override: 0.10, food_tax_override: null, alcohol_tax_override: null });
    expect(eff.generalTaxRate).toBeCloseTo(0.10);
    expect(eff.foodTaxRate).toBeCloseTo(0.08); // unchanged
    expect(eff.name).toBe('Charlotte, NC');
  });

  it('leaves rates unchanged when no overrides are set', () => {
    const eff = effectiveLocation(LOCATION, {});
    expect(eff.generalTaxRate).toBeCloseTo(0.0725);
    expect(eff.foodTaxRate).toBeCloseTo(0.08);
  });
});

describe('rawLineItemToExportItem', () => {
  const markupById = new Map([['cat-av', 0.65]]);
  const sectionById = new Map([['sec-1', { id: 'sec-1', name: 'Audio Visual' }]]);
  const base: RawLineItemRow = {
    section: 'AV', section_id: 'sec-1', name: 'Projector', label: null, qty: 2, unit_price: 100,
    category_id: 'cat-av', markup_override: null, custom_client_unit_price: null, tax_type: 'general',
    is_revenue_item: false, thumbnail_url: null, thumbnail_icon: null, package_options: null, selected_package_id: null,
  };

  it('resolves the section name/id from the section map', () => {
    const out = rawLineItemToExportItem(base, markupById, sectionById);
    expect(out.section).toBe('Audio Visual');
    expect(out.sectionId).toBe('sec-1');
  });

  it('uses the category markup by default', () => {
    expect(rawLineItemToExportItem(base, markupById, sectionById).categoryMarkupPct).toBeCloseTo(0.65);
  });

  it('honors a per-item markup override', () => {
    const out = rawLineItemToExportItem({ ...base, markup_override: 0.5 }, markupById, sectionById);
    expect(out.categoryMarkupPct).toBeCloseTo(0.5);
  });

  it('treats a custom-priced item as custom with markup 0', () => {
    const out = rawLineItemToExportItem({ ...base, custom_client_unit_price: 250 }, markupById, sectionById);
    expect(out.categoryId).toBe('custom');
    expect(out.categoryMarkupPct).toBe(0);
    expect(out.customClientUnitPrice).toBe(250);
  });

  it('falls back to category default 0.5 when the category is unknown', () => {
    const out = rawLineItemToExportItem({ ...base, category_id: 'unknown' }, markupById, sectionById);
    expect(out.categoryMarkupPct).toBeCloseTo(0.5);
  });
});

describe('same-name sections across estimates stay separate', () => {
  it('grouping each estimate by its own sections keeps FLORALS distinct per estimate', () => {
    // Two estimates each have a section literally named "FLORALS" but with different section IDs.
    const eventA = [
      { name: 'Roses A', section: 'FLORALS', sectionId: 'A-florals', qty: 1, unitPrice: 100, categoryMarkupPct: 0.85, categoryId: 'cat', taxType: 'general' },
    ];
    const eventB = [
      { name: 'Tulips B', section: 'FLORALS', sectionId: 'B-florals', qty: 1, unitPrice: 200, categoryMarkupPct: 0.85, categoryId: 'cat', taxType: 'general' },
    ];
    const groupsA = groupLineItemsBySections(eventA, [{ id: 'A-florals', name: 'FLORALS' }]);
    const groupsB = groupLineItemsBySections(eventB, [{ id: 'B-florals', name: 'FLORALS' }]);
    // Each estimate's FLORALS contains ONLY its own item — no cross-bleed.
    expect(groupsA).toHaveLength(1);
    expect(groupsA[0].items.map((i) => i.name)).toEqual(['Roses A']);
    expect(groupsB).toHaveLength(1);
    expect(groupsB[0].items.map((i) => i.name)).toEqual(['Tulips B']);
    expect(groupsA[0].id).not.toBe(groupsB[0].id);
  });
});

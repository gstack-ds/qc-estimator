// Export utility tests — validates the Copy Numbers grouped summary format

import { describe, it, expect } from 'vitest';
import {
  fmtAmt,
  itemClientCost,
  buildSummaryRows,
  buildCopyText,
  buildDetailedCopyText,
  groupLineItemsBySections,
} from '../../src/lib/utils/export';
import type { LineItemForExport, MarkupForExport, OrderedSection } from '../../src/lib/utils/export';
import type { EstimateSummary, VenueEstimateInput, ProgramConfig } from '../../src/types';
import { calculateVenueEstimate } from '../../src/lib/engine/pricing';

// ─── Fixtures ────────────────────────────────────────────

const STAFFING_MARKUP_ID = 'markup-staffing';
const MARKUPS: MarkupForExport[] = [
  { id: STAFFING_MARKUP_ID, name: 'Staffing & Labor' },
  { id: 'markup-catering', name: 'Catering & F&B' },
  { id: 'markup-av', name: 'AV & Production' },
];

function makeSummary(overrides: Partial<EstimateSummary> = {}): EstimateSummary {
  return {
    fbSubtotalOur: 0,
    fbSubtotalClient: 0,
    fbFoodSubtotalClient: 0,
    fbAlcoholSubtotalClient: 0,
    foodTax: 0,
    alcoholTax: 0,
    equipmentSubtotalOur: 0,
    equipmentSubtotalClient: 0,
    equipmentTax: 0,
    qcStaffingSubtotalOur: 0,
    qcStaffingSubtotalClient: 0,
    venueSubtotalOur: 0,
    venueSubtotalClient: 0,
    venueTax: 0,
    serviceChargeOur: 0,
    serviceChargeClient: 0,
    gratuityOur: 0,
    gratuityClient: 0,
    adminFeeOur: 0,
    adminFeeClient: 0,
    subtotalOur: 0,
    subtotalClient: 0,
    productionFee: 0,
    productionFeeTax: 0,
    lineItemsSubtotalClient: 0,
    preTaxTotal: 0,
    totalOur: 0,
    totalClient: 0,
    pricePerPerson: 0,
    fbMinimumMet: true,
    fbShortfall: 0,
    vendorTaxesTotal: 0,
    revenueItemsClientTotal: 0,
    discountAmount: 0,
    travelInProductionFee: 0,
    ...overrides,
  };
}

// ─── fmtAmt ──────────────────────────────────────────────

describe('fmtAmt', () => {
  it('formats whole dollar amounts with two decimal places', () => {
    expect(fmtAmt(1000)).toBe('$1,000.00');
    expect(fmtAmt(12345)).toBe('$12,345.00');
    expect(fmtAmt(500)).toBe('$500.00');
  });

  it('rounds cents to whole dollars', () => {
    expect(fmtAmt(1234.56)).toBe('$1,235.00');
    expect(fmtAmt(1234.49)).toBe('$1,234.00');
  });

  it('handles zero', () => {
    expect(fmtAmt(0)).toBe('$0.00');
  });
});

// ─── itemClientCost ──────────────────────────────────────

describe('itemClientCost', () => {
  it('calculates markup-based cost', () => {
    const li: LineItemForExport = {
      name: 'Chicken', section: 'F&B', qty: 10, unitPrice: 100,
      categoryMarkupPct: 0.55, categoryId: 'markup-catering', taxType: 'food',
    };
    expect(itemClientCost(li)).toBeCloseTo(1550, 2);
  });

  it('uses custom client unit price when category is custom', () => {
    const li: LineItemForExport = {
      name: 'Custom Item', section: 'F&B', qty: 5, unitPrice: 100,
      categoryMarkupPct: 0, categoryId: 'custom', customClientUnitPrice: 200, taxType: 'food',
    };
    expect(itemClientCost(li)).toBe(1000);
  });
});

// ─── buildSummaryRows — venue ────────────────────────────

describe('buildSummaryRows (venue)', () => {
  it('returns Menu and Bar Package from food/alcohol subtotals', () => {
    const summary = makeSummary({
      fbFoodSubtotalClient: 5000,
      fbAlcoholSubtotalClient: 2000,
      totalClient: 8000,
    });
    const rows = buildSummaryRows(summary, 'venue', [], MARKUPS);
    expect(rows.find((r) => r.label === 'Menu')?.amount).toBe(5000);
    expect(rows.find((r) => r.label === 'Bar Package')?.amount).toBe(2000);
  });

  it('omits rows with zero amount', () => {
    const summary = makeSummary({
      fbFoodSubtotalClient: 5000,
      fbAlcoholSubtotalClient: 0, // no bar
      venueSubtotalClient: 0,     // no venue rental
      totalClient: 5000,
    });
    const rows = buildSummaryRows(summary, 'venue', [], MARKUPS);
    const labels = rows.map((r) => r.label);
    expect(labels).not.toContain('Bar Package');
    expect(labels).not.toContain('Venue Rental');
    expect(labels).toContain('Menu');
  });

  it('shows rows in spec order: Menu, Bar Package, Staffing, Equipment, Venue Rental, Service Charge, Gratuity, Admin Fee, Production Fee, Tax', () => {
    const summary = makeSummary({
      fbFoodSubtotalClient: 5000,
      fbAlcoholSubtotalClient: 2000,
      qcStaffingSubtotalClient: 800,
      equipmentSubtotalClient: 1200,
      venueSubtotalClient: 3000,
      serviceChargeClient: 600,
      gratuityClient: 300,
      adminFeeClient: 150,
      productionFee: 500,
      foodTax: 362,
      alcoholTax: 145,
      totalClient: 14007,
    });
    const rows = buildSummaryRows(summary, 'venue', [], MARKUPS);
    const labels = rows.map((r) => r.label);
    expect(labels).toEqual(['Menu', 'Bar Package', 'Staffing', 'Equipment', 'Venue Rental', 'Service Charge', 'Gratuity', 'Admin Fee', 'Production Fee', 'Tax']);
  });

  it('includes Service Charge, Gratuity, Admin Fee rows when > 0', () => {
    const summary = makeSummary({
      fbFoodSubtotalClient: 5000,
      venueSubtotalClient: 2000,
      serviceChargeClient: 700,
      gratuityClient: 350,
      adminFeeClient: 175,
      totalClient: 8225,
    });
    const rows = buildSummaryRows(summary, 'venue', [], MARKUPS);
    expect(rows.find((r) => r.label === 'Service Charge')?.amount).toBe(700);
    expect(rows.find((r) => r.label === 'Gratuity')?.amount).toBe(350);
    expect(rows.find((r) => r.label === 'Admin Fee')?.amount).toBe(175);
  });

  it('omits Service Charge, Gratuity, Admin Fee rows when 0', () => {
    const summary = makeSummary({
      fbFoodSubtotalClient: 5000,
      serviceChargeClient: 0,
      gratuityClient: 0,
      adminFeeClient: 0,
      totalClient: 5000,
    });
    const rows = buildSummaryRows(summary, 'venue', [], MARKUPS);
    const labels = rows.map((r) => r.label);
    expect(labels).not.toContain('Service Charge');
    expect(labels).not.toContain('Gratuity');
    expect(labels).not.toContain('Admin Fee');
  });

  it('moves Staffing & Labor items out of Equipment bucket', () => {
    const lineItems: LineItemForExport[] = [
      {
        name: 'Event Staff', section: 'Equipment & Staffing', qty: 2, unitPrice: 500,
        categoryMarkupPct: 0.9, categoryId: STAFFING_MARKUP_ID, taxType: 'general',
      },
    ];
    // staffingFromEquipment = 2 * 500 * 1.9 = 1900
    const summary = makeSummary({
      equipmentSubtotalClient: 3000, // includes the staffing items
      qcStaffingSubtotalClient: 200, // from Non-Taxable Staffing section
      totalClient: 4000,
    });
    const rows = buildSummaryRows(summary, 'venue', lineItems, MARKUPS);
    const staffingRow = rows.find((r) => r.label === 'Staffing');
    const equipmentRow = rows.find((r) => r.label === 'Equipment');
    expect(staffingRow?.amount).toBeCloseTo(200 + 1900, 0); // 2100
    expect(equipmentRow?.amount).toBeCloseTo(3000 - 1900, 0); // 1100
  });

  it('hides Equipment row when all equipment is staffing-category items', () => {
    const lineItems: LineItemForExport[] = [
      {
        name: 'Event Staff', section: 'Equipment & Staffing', qty: 1, unitPrice: 1000,
        categoryMarkupPct: 0.9, categoryId: STAFFING_MARKUP_ID, taxType: 'general',
      },
    ];
    // staffingFromEquipment = 1 * 1000 * 1.9 = 1900
    const summary = makeSummary({
      equipmentSubtotalClient: 1900,
      qcStaffingSubtotalClient: 0,
      totalClient: 2000,
    });
    const rows = buildSummaryRows(summary, 'venue', lineItems, MARKUPS);
    expect(rows.find((r) => r.label === 'Equipment')).toBeUndefined();
    expect(rows.find((r) => r.label === 'Staffing')?.amount).toBeCloseTo(1900, 0);
  });
});

// ─── buildSummaryRows — av ───────────────────────────────

describe('buildSummaryRows (av)', () => {
  it('Tax row includes productionFeeTax', () => {
    const summary = makeSummary({
      equipmentSubtotalClient: 5000,
      equipmentTax: 50,
      productionFee: 400,
      productionFeeTax: 29,
      totalClient: 5479,
    });
    const rows = buildSummaryRows(summary, 'av', [], MARKUPS);
    expect(rows.find((r) => r.label === 'Tax')?.amount).toBe(79); // equipmentTax + productionFeeTax
  });

  it('row amounts sum to totalClient when productionFeeTax > 0', () => {
    const summary = makeSummary({
      equipmentSubtotalClient: 5000,
      equipmentTax: 50,
      productionFee: 400,
      productionFeeTax: 29,
      totalClient: 5479, // 5000 + 50 + 400 + 29
    });
    const rows = buildSummaryRows(summary, 'av', [], MARKUPS);
    const rowSum = rows.reduce((s, r) => s + r.amount, 0);
    expect(rowSum).toBe(5479);
  });

  it('returns AV Equipment, Labor & Fees, Tax, Production Fee', () => {
    const summary = makeSummary({
      equipmentSubtotalClient: 5000,
      qcStaffingSubtotalClient: 1000,
      equipmentTax: 362,
      productionFee: 400,
      totalClient: 6762,
    });
    const rows = buildSummaryRows(summary, 'av', [], MARKUPS);
    const labels = rows.map((r) => r.label);
    expect(labels).toEqual(['AV Equipment', 'Labor & Fees', 'Tax', 'Production Fee']);
  });
});

// ─── buildSummaryRows (tour) ─────────────────────────────

describe('buildSummaryRows (tour)', () => {
  it('returns Tour & Experiences from equipmentSubtotalClient', () => {
    const summary = makeSummary({ equipmentSubtotalClient: 4000, totalClient: 4000 });
    const rows = buildSummaryRows(summary, 'tour', [], MARKUPS);
    expect(rows.find((r) => r.label === 'Tour & Experiences')?.amount).toBe(4000);
  });

  it('returns Non-Taxable Fees from qcStaffingSubtotalClient', () => {
    const summary = makeSummary({ qcStaffingSubtotalClient: 1200, totalClient: 1200 });
    const rows = buildSummaryRows(summary, 'tour', [], MARKUPS);
    expect(rows.find((r) => r.label === 'Non-Taxable Fees')?.amount).toBe(1200);
  });

  it('includes Tax and Production Fee when present', () => {
    const summary = makeSummary({
      equipmentSubtotalClient: 3000,
      equipmentTax: 180,
      productionFee: 250,
      totalClient: 3430,
    });
    const rows = buildSummaryRows(summary, 'tour', [], MARKUPS);
    const labels = rows.map((r) => r.label);
    expect(labels).toEqual(['Tour & Experiences', 'Tax', 'Production Fee']);
  });

  it('omits zero-amount rows', () => {
    const summary = makeSummary({ equipmentSubtotalClient: 4000, qcStaffingSubtotalClient: 0, totalClient: 4000 });
    const rows = buildSummaryRows(summary, 'tour', [], MARKUPS);
    expect(rows.find((r) => r.label === 'Non-Taxable Fees')).toBeUndefined();
  });

  it('does not include venue-style rows (Menu, Bar Package, Venue Rental, Service Charge)', () => {
    const summary = makeSummary({ equipmentSubtotalClient: 5000, totalClient: 5000 });
    const rows = buildSummaryRows(summary, 'tour', [], MARKUPS);
    const labels = rows.map((r) => r.label);
    expect(labels).not.toContain('Menu');
    expect(labels).not.toContain('Bar Package');
    expect(labels).not.toContain('Venue Rental');
    expect(labels).not.toContain('Service Charge');
  });
});

// ─── buildDetailedCopyText ───────────────────────────────

describe('buildDetailedCopyText', () => {
  it('starts with estimate name in caps', () => {
    const text = buildDetailedCopyText([], makeSummary(), 50, 'Spring Gala');
    expect(text.split('\n')[0]).toBe('SPRING GALA');
  });

  it('second line is blank', () => {
    const text = buildDetailedCopyText([], makeSummary(), 50, 'Test');
    expect(text.split('\n')[1]).toBe('');
  });

  it('third line is the 5-column header', () => {
    const text = buildDetailedCopyText([], makeSummary(), 50, 'Test');
    expect(text.split('\n')[2]).toBe('Item\tQty\tUnit Price\tOur Cost\tClient Cost');
  });

  it('shows section name above item rows', () => {
    const items: LineItemForExport[] = [
      { name: 'Chicken Dinner', section: 'F&B', qty: 10, unitPrice: 50, categoryMarkupPct: 0.55, categoryId: 'markup-catering', taxType: 'food' },
    ];
    const text = buildDetailedCopyText(items, makeSummary(), 50, 'Test');
    expect(text).toContain('F&B');
  });

  it('shows individual item row with correct values', () => {
    const items: LineItemForExport[] = [
      { name: 'Chicken Dinner', section: 'F&B', qty: 10, unitPrice: 50, categoryMarkupPct: 0.55, categoryId: 'markup-catering', taxType: 'food' },
    ];
    // ourCost = 10 * 50 = 500, clientCost = 10 * 50 * 1.55 = 775
    const text = buildDetailedCopyText(items, makeSummary(), 50, 'Test');
    expect(text).toContain('Chicken Dinner\t10\t$50.00\t$500.00\t$775.00');
  });

  it('shows section subtotal row with our cost and client cost sums', () => {
    const items: LineItemForExport[] = [
      { name: 'Item A', section: 'F&B', qty: 1, unitPrice: 100, categoryMarkupPct: 0.55, categoryId: 'markup-catering', taxType: 'food' },
      { name: 'Item B', section: 'F&B', qty: 2, unitPrice: 50, categoryMarkupPct: 0.55, categoryId: 'markup-catering', taxType: 'food' },
    ];
    // ourCost: 100 + 100 = 200, clientCost: 155 + 155 = 310
    const text = buildDetailedCopyText(items, makeSummary(), 50, 'Test');
    expect(text).toContain('F&B Total\t\t\t$200.00\t$310.00');
  });

  it('groups items into separate sections', () => {
    const items: LineItemForExport[] = [
      { name: 'Food Item', section: 'F&B', qty: 1, unitPrice: 100, categoryMarkupPct: 0.55, categoryId: 'markup-catering', taxType: 'food' },
      { name: 'Equipment', section: 'Equipment & Staffing', qty: 1, unitPrice: 200, categoryMarkupPct: 0.65, categoryId: 'markup-av', taxType: 'general' },
    ];
    const text = buildDetailedCopyText(items, makeSummary(), 50, 'Test');
    expect(text).toContain('F&B Total');
    expect(text).toContain('Equipment & Staffing Total');
  });

  it('shows Service Charge, Gratuity, Admin Fee when > 0', () => {
    const summary = makeSummary({ serviceChargeClient: 700, gratuityClient: 350, adminFeeClient: 175 });
    const text = buildDetailedCopyText([], summary, 50, 'Test');
    expect(text).toContain('Service Charge\t\t\t\t$700.00');
    expect(text).toContain('Gratuity\t\t\t\t$350.00');
    expect(text).toContain('Admin Fee\t\t\t\t$175.00');
  });

  it('omits Service Charge, Gratuity, Admin Fee when 0', () => {
    const summary = makeSummary({ serviceChargeClient: 0, gratuityClient: 0, adminFeeClient: 0 });
    const text = buildDetailedCopyText([], summary, 50, 'Test');
    expect(text).not.toContain('Service Charge');
    expect(text).not.toContain('Gratuity');
    expect(text).not.toContain('Admin Fee');
  });

  it('shows Production Fee when > 0', () => {
    const summary = makeSummary({ productionFee: 500 });
    const text = buildDetailedCopyText([], summary, 50, 'Test');
    expect(text).toContain('Production Fee\t\t\t\t$500.00');
  });

  it('shows Tax when > 0', () => {
    const summary = makeSummary({ foodTax: 362, alcoholTax: 145 });
    const text = buildDetailedCopyText([], summary, 50, 'Test');
    expect(text).toContain('Tax\t\t\t\t$507.00');
  });

  it('Tax line includes productionFeeTax', () => {
    const summary = makeSummary({ foodTax: 600, productionFeeTax: 58 });
    const text = buildDetailedCopyText([], summary, 50, 'Test');
    expect(text).toContain('Tax\t\t\t\t$658.00'); // 600 + 58
  });

  it('productionFee + Tax row equals totalClient when no other fees or items', () => {
    // totalClient = productionFee + foodTax + productionFeeTax
    const summary = makeSummary({
      productionFee: 800,
      foodTax: 600,
      productionFeeTax: 58,
      totalClient: 1458,
    });
    const text = buildDetailedCopyText([], summary, 50, 'Test');
    // Both rows present, their amounts must sum to totalClient
    expect(text).toContain('Production Fee\t\t\t\t$800.00');
    expect(text).toContain('Tax\t\t\t\t$658.00');
    expect(text).toContain('TOTAL ESTIMATE\t\t\t\t$1,458.00');
  });

  it('shows TOTAL ESTIMATE and Price PP', () => {
    const summary = makeSummary({ totalClient: 15000 });
    const text = buildDetailedCopyText([], summary, 50, 'Test');
    expect(text).toContain('TOTAL ESTIMATE\t\t\t\t$15,000.00');
    expect(text).toContain('Price PP\t\t\t\t$300.00');  // ceil(15000/50)
  });

  it('shows ourCost as $0 for revenue items and clientCost as qty × unitPrice', () => {
    const items: LineItemForExport[] = [
      {
        name: 'Coordinator Fee', section: 'Non-Taxable Staffing', qty: 1, unitPrice: 500,
        categoryMarkupPct: 0.9, categoryId: STAFFING_MARKUP_ID, taxType: 'none',
        isRevenueItem: true,
      },
    ];
    // isRevenue: ourCost = 0, clientCost = 1 * 500 = 500
    const text = buildDetailedCopyText(items, makeSummary(), 50, 'Test');
    expect(text).toContain('Coordinator Fee\t1\t$500.00\t$0.00\t$500.00');
  });

  it('revenue item section subtotal excludes ourCost', () => {
    const items: LineItemForExport[] = [
      {
        name: 'Coordinator Fee', section: 'Non-Taxable Staffing', qty: 2, unitPrice: 500,
        categoryMarkupPct: 0.9, categoryId: STAFFING_MARKUP_ID, taxType: 'none',
        isRevenueItem: true,
      },
    ];
    // ourCostSum = 0, clientCostSum = 2 * 500 = 1000
    const text = buildDetailedCopyText(items, makeSummary(), 50, 'Test');
    expect(text).toContain('Non-Taxable Staffing Total\t\t\t$0.00\t$1,000.00');
  });

  it('filters out items with qty=0 or unitPrice=0', () => {
    const items: LineItemForExport[] = [
      { name: 'Zero Qty', section: 'F&B', qty: 0, unitPrice: 100, categoryMarkupPct: 0.55, categoryId: 'markup-catering', taxType: 'food' },
      { name: 'Zero Price', section: 'F&B', qty: 5, unitPrice: 0, categoryMarkupPct: 0.55, categoryId: 'markup-catering', taxType: 'food' },
    ];
    const text = buildDetailedCopyText(items, makeSummary(), 50, 'Test');
    expect(text).not.toContain('Zero Qty');
    expect(text).not.toContain('Zero Price');
  });
});

// ─── buildCopyText ───────────────────────────────────────

describe('buildCopyText', () => {
  it('outputs estimate name in caps on first line', () => {
    const summary = makeSummary({ fbFoodSubtotalClient: 5000, totalClient: 5000 });
    const text = buildCopyText(summary, 50, 'venue', 'The Belmond — Ballroom', [], MARKUPS);
    expect(text.split('\n')[0]).toBe('THE BELMOND — BALLROOM');
  });

  it('second line is blank', () => {
    const summary = makeSummary({ fbFoodSubtotalClient: 5000, totalClient: 5000 });
    const text = buildCopyText(summary, 50, 'venue', 'Test', [], MARKUPS);
    expect(text.split('\n')[1]).toBe('');
  });

  it('third line is tab-separated header row', () => {
    const summary = makeSummary({ fbFoodSubtotalClient: 5000, totalClient: 5000 });
    const text = buildCopyText(summary, 50, 'venue', 'Test', [], MARKUPS);
    expect(text.split('\n')[2]).toBe('Item\tAmount');
  });

  it('formats amounts with $ and commas, tab-separated', () => {
    const summary = makeSummary({ fbFoodSubtotalClient: 12500, totalClient: 12500 });
    const text = buildCopyText(summary, 50, 'venue', 'Test', [], MARKUPS);
    expect(text).toContain('Menu\t$12,500.00');
  });

  it('includes TOTAL ESTIMATE line tab-separated', () => {
    const summary = makeSummary({ fbFoodSubtotalClient: 5000, totalClient: 15000 });
    const text = buildCopyText(summary, 50, 'venue', 'Test', [], MARKUPS);
    expect(text).toContain('TOTAL ESTIMATE\t$15,000.00');
  });

  it('includes Price PP line rounded up, tab-separated', () => {
    const summary = makeSummary({ totalClient: 15001 });
    const text = buildCopyText(summary, 50, 'venue', 'Test', [], MARKUPS);
    // ceil(15001 / 50) = 301
    expect(text).toContain('Price PP\t$301.00');
  });

  it('Tax row in copy output includes productionFeeTax', () => {
    const summary = makeSummary({
      equipmentSubtotalClient: 4000,
      equipmentTax: 72,
      productionFee: 350,
      productionFeeTax: 25,
      totalClient: 4447, // 4000 + 72 + 350 + 25
    });
    const text = buildCopyText(summary, 50, 'av', 'Test', [], MARKUPS);
    expect(text).toContain('Tax\t$97.00'); // equipmentTax(72) + productionFeeTax(25)
    expect(text).toContain('TOTAL ESTIMATE\t$4,447.00');
  });

  it('full venue estimate with real numbers matches spec format', () => {
    const summary = makeSummary({
      fbFoodSubtotalClient: 8680,
      fbAlcoholSubtotalClient: 3250,
      qcStaffingSubtotalClient: 475,
      equipmentSubtotalClient: 620,
      venueSubtotalClient: 1500,
      serviceChargeClient: 1736,
      gratuityClient: 868,
      adminFeeClient: 434,
      productionFee: 872,
      foodTax: 629,
      alcoholTax: 236,
      equipmentTax: 45,
      totalClient: 19345,
    });
    const text = buildCopyText(summary, 75, 'venue', 'Spring Gala — The Belmond', [], MARKUPS);
    const lines = text.split('\n');
    expect(lines[0]).toBe('SPRING GALA — THE BELMOND');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('Item\tAmount');
    expect(text).toContain('Menu\t$8,680.00');
    expect(text).toContain('Bar Package\t$3,250.00');
    expect(text).toContain('Staffing\t$475.00');
    expect(text).toContain('Equipment\t$620.00');
    expect(text).toContain('Venue Rental\t$1,500.00');
    expect(text).toContain('Service Charge\t$1,736.00');
    expect(text).toContain('Gratuity\t$868.00');
    expect(text).toContain('Admin Fee\t$434.00');
    expect(text).toContain('Production Fee\t$872.00');
    expect(text).toContain('Tax\t$910.00'); // 629+236+45
    expect(text).toContain('TOTAL ESTIMATE\t$19,345.00');
    expect(text).toContain('Price PP\t$258.00'); // ceil(19345/75)
  });
});

// ─── buildDetailedCopyText — row sum equals totalClient ───
// Regression guard for the class of bug fixed 2026-06-07:
// a new fee field was added to summary.totalClient in the engine (productionFeeTax)
// but not to the Tax row in buildDetailedCopyText, causing itemized rows to not
// add up to the total. This test catches any recurrence.

describe('buildDetailedCopyText — row sum equals totalClient', () => {
  // Multi-section estimate: F&B food + AV equipment + service charge.
  // Uses calculateVenueEstimate to get the authoritative summary so we test
  // the real engine values, not manually-cooked numbers.
  //
  // Inputs:
  //   F&B Dinner: qty=25, ourCost=$100, markup=55% → clientCost=$3875 (25×100×1.55)
  //   AV LED Wall: qty=1, ourCost=$500, markup=65% → clientCost=$825 (1×500×1.65)
  //   serviceCharge=20% of fbSubtotalClient=3875 → 775
  //   Charlotte tax 7.25%: foodTax=3875×0.0725=280.94, equipmentTax=825×0.0725=59.81
  //   CC=3.5%, clientComm=5%, GDP=off
  //
  //   markupRevenue = 3875 + 825 + 775 = 5475
  //   subtotalClient = 3875 + 280.94 + 825 + 59.81 + 775 = 5815.75
  //   productionFee = 5815.75×0.035 + 5475×0.05 = 203.55 + 273.75 = 477.30
  //   productionFeeTax = 477.30×0.0725 = 34.60
  //   totalClient = 5815.75 + 477.30 + 34.60 = 6327.65
  const config: ProgramConfig = {
    guestCount: 25,
    location: { id: 'loc-cllt', name: 'Charlotte NC', foodTaxRate: 0.0725, alcoholTaxRate: 0.0725, generalTaxRate: 0.0725 },
    ccProcessingFee: 0.035,
    clientCommission: 0.05,
    gdpCommissionEnabled: false,
    gdpCommissionRate: 0.065,
    serviceChargeDefault: 0.20,
    gratuityDefault: 0,
    adminFeeDefault: 0,
  };
  const engineInput: VenueEstimateInput = {
    name: 'Row Sum Test',
    fbMinimum: 0,
    isVenueTaxable: false,
    serviceCharge: 0.20,
    gratuity: 0,
    adminFee: 0,
    lineItems: [
      { id: 'f1', section: 'F&B', taxBucket: 'fb', name: 'Dinner', qty: 25, unitPrice: 100, categoryMarkupPct: 0.55, taxType: 'food' },
      { id: 'e1', section: 'AV', taxBucket: 'equipment', name: 'LED Wall', qty: 1, unitPrice: 500, categoryMarkupPct: 0.65, taxType: 'general' },
    ],
  };
  const lineItemsForExport: LineItemForExport[] = [
    { name: 'Dinner', section: 'F&B', qty: 25, unitPrice: 100, categoryMarkupPct: 0.55, categoryId: 'markup-catering', taxType: 'food' },
    { name: 'LED Wall', section: 'AV', qty: 1, unitPrice: 500, categoryMarkupPct: 0.65, categoryId: 'markup-av', taxType: 'general' },
  ];

  it('Tax row in output includes productionFeeTax (not just line item taxes)', () => {
    const summary = calculateVenueEstimate(engineInput, config);
    const text = buildDetailedCopyText(lineItemsForExport, summary, 25, 'Row Sum Test');
    const expectedTax = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax + summary.productionFeeTax;
    // productionFeeTax must be included — if missing the Tax line would be ~340, not ~375
    expect(text).toContain(`Tax\t\t\t\t${fmtAmt(expectedTax)}`);
  });

  it('section client totals + service charge + production fee + all taxes sum to totalClient', () => {
    const summary = calculateVenueEstimate(engineInput, config);
    // itemClientCost produces the same values as the engine for non-override items
    const fbSectionClientTotal = itemClientCost(lineItemsForExport[0]);  // 25×100×1.55 = 3875
    const avSectionClientTotal = itemClientCost(lineItemsForExport[1]);  // 1×500×1.65  = 825
    const allTaxes = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax + summary.productionFeeTax;
    const rowsSum = fbSectionClientTotal + avSectionClientTotal
      + summary.serviceChargeClient
      + summary.productionFee
      + allTaxes;
    // If any fee is missing from allTaxes, rowsSum < totalClient and this assertion fails
    expect(rowsSum).toBeCloseTo(summary.totalClient, 1);
  });
});

// ─── Section grouping (proposal PDF) — same-name sections must not cross-emit ──

describe('groupLineItemsBySections', () => {
  function li(p: Partial<LineItemForExport> & { name: string; section: string }): LineItemForExport {
    return {
      qty: 1, unitPrice: 100, categoryMarkupPct: 0, categoryId: null, taxType: 'general', ...p,
    };
  }

  it('renders two same-NAMED sections as distinct blocks, each with ONLY its own items', () => {
    // Mirrors the live bug: two sections both named "FLORALS" (different ids).
    const items: LineItemForExport[] = [
      li({ name: 'Photo Opp Pieces', section: 'FLORALS', sectionId: 'fl-A' }),
      li({ name: 'Product Enhancing Pieces', section: 'FLORALS', sectionId: 'fl-A' }),
      li({ name: 'Setup/Breakdown', section: 'FLORALS', sectionId: 'fl-B' }),
    ];
    const ordered: OrderedSection[] = [
      { id: 'fl-A', name: 'FLORALS' },
      { id: 'fl-B', name: 'FLORALS' },
    ];
    const groups = groupLineItemsBySections(items, ordered);

    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.name)).toEqual(['Photo Opp Pieces', 'Product Enhancing Pieces']);
    expect(groups[1].items.map((i) => i.name)).toEqual(['Setup/Breakdown']);
    // No item appears in more than one group (the bug was each appearing twice).
    const allNames = groups.flatMap((g) => g.items.map((i) => i.name));
    expect(allNames).toEqual(['Photo Opp Pieces', 'Product Enhancing Pieces', 'Setup/Breakdown']);
  });

  it('drops an empty same-named section instead of double-emitting the other one\'s items', () => {
    // Section fl-B is named FLORALS but holds no items (the leftover dup in the live data).
    const items: LineItemForExport[] = [
      li({ name: 'Photo Opp Pieces', section: 'FLORALS', sectionId: 'fl-A' }),
    ];
    const ordered: OrderedSection[] = [
      { id: 'fl-A', name: 'FLORALS' },
      { id: 'fl-B', name: 'FLORALS' },
    ];
    const groups = groupLineItemsBySections(items, ordered);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('fl-A');
    expect(groups[0].items).toHaveLength(1);
  });

  it('single sections (SIGNAGE/OTHER/STAFFING) render once each', () => {
    const items: LineItemForExport[] = [
      li({ name: 'Hanging Signs', section: 'SIGNAGE', sectionId: 'sig' }),
      li({ name: 'Bin for Bin Dive', section: 'OTHER', sectionId: 'oth' }),
      li({ name: 'QC Management Fee', section: 'STAFFING', sectionId: 'stf' }),
    ];
    const ordered: OrderedSection[] = [
      { id: 'sig', name: 'SIGNAGE' }, { id: 'oth', name: 'OTHER' }, { id: 'stf', name: 'STAFFING' },
    ];
    const groups = groupLineItemsBySections(items, ordered);
    expect(groups.map((g) => g.name)).toEqual(['SIGNAGE', 'OTHER', 'STAFFING']);
    expect(groups.every((g) => g.items.length === 1)).toBe(true);
  });

  it('falls back to per-item sections (by id) when orderedSections is absent', () => {
    const items: LineItemForExport[] = [
      li({ name: 'A', section: 'FLORALS', sectionId: 'fl-A' }),
      li({ name: 'B', section: 'FLORALS', sectionId: 'fl-A' }),
      li({ name: 'C', section: 'SIGNAGE', sectionId: 'sig' }),
    ];
    const groups = groupLineItemsBySections(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.name)).toEqual(['A', 'B']);
    expect(groups[1].items.map((i) => i.name)).toEqual(['C']);
  });
});

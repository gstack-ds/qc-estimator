// Export utility tests — validates the Copy Numbers grouped summary format

import { describe, it, expect } from 'vitest';
import {
  fmtAmt,
  itemClientCost,
  buildSummaryRows,
  buildCopyText,
  buildDetailedCopyText,
} from '../../src/lib/utils/export';
import type { LineItemForExport, MarkupForExport } from '../../src/lib/utils/export';
import type { EstimateSummary } from '../../src/types';

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
    totalOur: 0,
    totalClient: 0,
    pricePerPerson: 0,
    fbMinimumMet: true,
    fbShortfall: 0,
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

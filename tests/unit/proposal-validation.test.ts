// Proposal Validation Tests
// Compares engine output against known Excel workbook inputs for regression detection.
//
// TODO(Gary): Each EXPECTED_* constant is currently computed from the engine itself
// using the inputs defined below — they are regression anchors, not yet validated
// against the actual Excel workbook. To validate:
//   1. Enter the same inputs (config + line items) in the Excel workbook.
//   2. Compare the Excel output to the EXPECTED_* values below.
//   3. If they differ, update EXPECTED_* to the Excel value — that means the engine
//      has a bug to investigate.
// Replace each "// placeholder" comment with the proposal name/date for traceability.

import { describe, it, expect } from 'vitest';
import { calculateVenueEstimate, calculateMarginAnalysis } from '../../src/lib/engine/pricing';
import type { ProgramConfig, VenueEstimateInput, TeamHoursTier } from '../../src/types';

// ─── Shared fixtures ─────────────────────────────────────

const TIERS: TeamHoursTier[] = [
  { revenueThreshold: 0,     baseHours: 5,  tierName: 'Micro' },
  { revenueThreshold: 5000,  baseHours: 10, tierName: 'Micro' },
  { revenueThreshold: 10000, baseHours: 20, tierName: 'Small' },
  { revenueThreshold: 20000, baseHours: 28, tierName: 'Standard' },
  { revenueThreshold: 35000, baseHours: 40, tierName: 'Large' },
];

const CHARLOTTE = {
  id: 'charlotte',
  name: 'Mecklenburg County NC (Charlotte)',
  foodTaxRate: 0.0725,
  alcoholTaxRate: 0.0725,
  generalTaxRate: 0.0725,
};

const DC = {
  id: 'dc',
  name: 'Washington DC',
  foodTaxRate: 0.10,
  alcoholTaxRate: 0.10,
  generalTaxRate: 0.10,
};

// Tolerance: results must match within $1
function withinDollar(actual: number, expected: number) {
  return Math.abs(actual - expected) < 1;
}

// ─── Proposal 1: Simple F&B dinner, Charlotte, no service fees ───────────────
// placeholder — replace with real proposal name, e.g. "Acme Corp Dinner 2026-06-15"
// TODO(Gary): Verify EXPECTED_* against Excel for this scenario before removing placeholder note.

describe('Proposal 1 — 50-guest F&B dinner, Charlotte, no restaurant fees (placeholder)', () => {
  // EXPECTED values computed by the engine from the inputs below.
  // Replace with actual Excel workbook numbers once validated.
  const EXPECTED_TOTAL_CLIENT   = 7641.75;  // TODO: verify against Excel
  const EXPECTED_VENDOR_COSTS   = 4250.00;  // TODO: verify against Excel
  const EXPECTED_TOTAL_TAXES    =  477.59;  // TODO: verify against Excel
  const EXPECTED_CC_PROCESSING  =  247.28;  // TODO: verify against Excel
  const EXPECTED_QC_MARGIN      = 2666.88;  // TODO: verify against Excel

  const config: ProgramConfig = {
    guestCount: 50,
    location: CHARLOTTE,
    ccProcessingFee: 0.035,
    clientCommission: 0.05,
    gdpCommissionEnabled: false,
    gdpCommissionRate: 0.065,
    serviceChargeDefault: 0,
    gratuityDefault: 0,
    adminFeeDefault: 0,
    thirdPartyCommissions: [],
  };

  const input: VenueEstimateInput = {
    name: 'Proposal 1 (placeholder)',
    fbMinimum: 0,
    isVenueTaxable: false,
    serviceCharge: 0,
    gratuity: 0,
    adminFee: 0,
    lineItems: [
      {
        id: 'li-1', section: 'F&B', taxBucket: 'fb', name: 'Plated Dinner',
        qty: 50, unitPrice: 60, categoryMarkupPct: 0.55, taxType: 'food',
      },
      {
        id: 'li-2', section: 'F&B', taxBucket: 'fb', name: 'Open Bar',
        qty: 50, unitPrice: 25, categoryMarkupPct: 0.55, taxType: 'alcohol',
      },
    ],
  };

  const summary = calculateVenueEstimate(input, config);
  const margin  = calculateMarginAnalysis(summary, config, TIERS);

  it('total client billing within $1 of expected', () => {
    expect(withinDollar(summary.totalClient, EXPECTED_TOTAL_CLIENT)).toBe(true);
  });

  it('vendor costs (base) within $1 of expected', () => {
    expect(withinDollar(margin.vendorCostsBase, EXPECTED_VENDOR_COSTS)).toBe(true);
  });

  it('total taxes within $1 of expected', () => {
    expect(withinDollar(margin.totalTaxes, EXPECTED_TOTAL_TAXES)).toBe(true);
  });

  it('CC processing within $1 of expected', () => {
    expect(withinDollar(margin.ccProcessingAmount, EXPECTED_CC_PROCESSING)).toBe(true);
  });

  it('QC margin (revenue) within $1 of expected', () => {
    expect(withinDollar(margin.qcRevenue, EXPECTED_QC_MARGIN)).toBe(true);
  });

  it('margin pct is healthy (≥28%)', () => {
    expect(margin.qcMarginPct).toBeGreaterThanOrEqual(0.28);
  });
});


// ─── Proposal 2: 100-guest F&B event, DC, 20% service charge + GDP commission ─
// placeholder — replace with real proposal name, e.g. "TechCo Summit 2026-09-20"
// TODO(Gary): Verify EXPECTED_* against Excel for this scenario before removing placeholder note.

describe('Proposal 2 — 100-guest F&B, DC, 20% SC + GDP commission (placeholder)', () => {
  // EXPECTED values computed by the engine from the inputs below.
  const EXPECTED_TOTAL_CLIENT   = 23963.78; // TODO: verify against Excel
  const EXPECTED_VENDOR_COSTS   = 13200.00; // TODO: verify against Excel
  const EXPECTED_TOTAL_TAXES    =  1705.00; // TODO: verify against Excel
  const EXPECTED_CC_PROCESSING  =   775.78; // TODO: verify against Excel
  const EXPECTED_GDP_COMMISSION =  1329.90; // TODO: verify against Excel
  const EXPECTED_QC_MARGIN      =  6953.10; // TODO: verify against Excel

  const config: ProgramConfig = {
    guestCount: 100,
    location: DC,
    ccProcessingFee: 0.035,
    clientCommission: 0.05,
    gdpCommissionEnabled: true,
    gdpCommissionRate: 0.065,
    serviceChargeDefault: 0.20,
    gratuityDefault: 0,
    adminFeeDefault: 0,
    thirdPartyCommissions: [],
  };

  const input: VenueEstimateInput = {
    name: 'Proposal 2 (placeholder)',
    fbMinimum: 0,
    isVenueTaxable: false,
    serviceCharge: 0.20,
    gratuity: 0,
    adminFee: 0,
    lineItems: [
      {
        id: 'li-1', section: 'F&B', taxBucket: 'fb', name: 'Plated Dinner',
        qty: 100, unitPrice: 80, categoryMarkupPct: 0.55, taxType: 'food',
      },
      {
        id: 'li-2', section: 'F&B', taxBucket: 'fb', name: 'Open Bar',
        qty: 100, unitPrice: 30, categoryMarkupPct: 0.55, taxType: 'alcohol',
      },
    ],
  };

  const summary = calculateVenueEstimate(input, config);
  const margin  = calculateMarginAnalysis(summary, config, TIERS);

  it('total client billing within $1 of expected', () => {
    expect(withinDollar(summary.totalClient, EXPECTED_TOTAL_CLIENT)).toBe(true);
  });

  it('vendor costs (base) within $1 of expected', () => {
    expect(withinDollar(margin.vendorCostsBase, EXPECTED_VENDOR_COSTS)).toBe(true);
  });

  it('total taxes within $1 of expected', () => {
    expect(withinDollar(margin.totalTaxes, EXPECTED_TOTAL_TAXES)).toBe(true);
  });

  it('CC processing within $1 of expected', () => {
    expect(withinDollar(margin.ccProcessingAmount, EXPECTED_CC_PROCESSING)).toBe(true);
  });

  it('GDP commission within $1 of expected', () => {
    expect(withinDollar(margin.gdpCommissionAmount, EXPECTED_GDP_COMMISSION)).toBe(true);
  });

  it('QC margin (revenue) within $1 of expected', () => {
    expect(withinDollar(margin.qcRevenue, EXPECTED_QC_MARGIN)).toBe(true);
  });

  it('margin pct is on-target (≥22%)', () => {
    expect(margin.qcMarginPct).toBeGreaterThanOrEqual(0.22);
  });
});


// ─── Proposal 3: 75-guest decor/rental estimate, Charlotte, no food ──────────
// placeholder — replace with real proposal name, e.g. "Finance Co Gala Décor 2026-11-05"
// TODO(Gary): Verify EXPECTED_* against Excel for this scenario before removing placeholder note.

describe('Proposal 3 — 75-guest decor/rentals, Charlotte, no F&B (placeholder)', () => {
  // EXPECTED values computed by the engine from the inputs below.
  const EXPECTED_TOTAL_CLIENT   = 10662.69; // TODO: verify against Excel
  const EXPECTED_VENDOR_COSTS   =  5000.00; // TODO: verify against Excel
  const EXPECTED_TOTAL_TAXES    =   563.33; // TODO: verify against Excel
  const EXPECTED_CC_PROCESSING  =   344.87; // TODO: verify against Excel
  const EXPECTED_QC_MARGIN      =  4754.50; // TODO: verify against Excel

  const config: ProgramConfig = {
    guestCount: 75,
    location: CHARLOTTE,
    ccProcessingFee: 0.035,
    clientCommission: 0.05,
    gdpCommissionEnabled: false,
    gdpCommissionRate: 0.065,
    serviceChargeDefault: 0,
    gratuityDefault: 0,
    adminFeeDefault: 0,
    thirdPartyCommissions: [],
  };

  const input: VenueEstimateInput = {
    name: 'Proposal 3 (placeholder)',
    fbMinimum: 0,
    isVenueTaxable: false,
    serviceCharge: 0,
    gratuity: 0,
    adminFee: 0,
    lineItems: [
      {
        id: 'li-1', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'Table Centerpieces',
        qty: 25, unitPrice: 120, categoryMarkupPct: 0.85, taxType: 'general',
      },
      {
        id: 'li-2', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'Linens',
        qty: 30, unitPrice: 40, categoryMarkupPct: 0.85, taxType: 'general',
      },
      {
        id: 'li-3', section: 'Non-Taxable Staffing', taxBucket: 'staffing', name: 'Setup Crew',
        qty: 4, unitPrice: 200, categoryMarkupPct: 0.90, taxType: 'none',
      },
    ],
  };

  const summary = calculateVenueEstimate(input, config);
  const margin  = calculateMarginAnalysis(summary, config, TIERS);

  it('total client billing within $1 of expected', () => {
    expect(withinDollar(summary.totalClient, EXPECTED_TOTAL_CLIENT)).toBe(true);
  });

  it('vendor costs (base) within $1 of expected', () => {
    expect(withinDollar(margin.vendorCostsBase, EXPECTED_VENDOR_COSTS)).toBe(true);
  });

  it('total taxes within $1 of expected', () => {
    expect(withinDollar(margin.totalTaxes, EXPECTED_TOTAL_TAXES)).toBe(true);
  });

  it('CC processing within $1 of expected', () => {
    expect(withinDollar(margin.ccProcessingAmount, EXPECTED_CC_PROCESSING)).toBe(true);
  });

  it('QC margin (revenue) within $1 of expected', () => {
    expect(withinDollar(margin.qcRevenue, EXPECTED_QC_MARGIN)).toBe(true);
  });

  it('margin pct is strong (≥35%)', () => {
    expect(margin.qcMarginPct).toBeGreaterThanOrEqual(0.35);
  });

  it('no F&B subtotal (decor-only)', () => {
    expect(summary.fbSubtotalClient).toBe(0);
  });
});

// Pricing Engine Tests
// These tests validate against known values from QC_Estimate_Template_2026.xlsx
// The "Beau Beau" venue estimate with Charlotte/Mecklenburg County tax rates

import { describe, it, expect } from 'vitest';
import {
  parseFeeRate,
  getTaxRate,
  calculateLineItem,
  calculateVenueEstimate,
  getMarginHealth,
  getNetHealth,
  lookupTeamHours,
  calculateMarginAnalysis,
} from '../../src/lib/engine/pricing';
import type { ProgramConfig, LineItem, VenueEstimateInput, TeamHoursTier } from '../../src/types';

// ─── Test Fixtures ───────────────────────────────────────

const CHARLOTTE_LOCATION = {
  id: 'loc-1',
  name: 'Mecklenburg County NC (Charlotte)',
  foodTaxRate: 0.0725,
  alcoholTaxRate: 0.0725,
  generalTaxRate: 0.0725,
};

const BASE_CONFIG: ProgramConfig = {
  guestCount: 50,
  location: CHARLOTTE_LOCATION,
  ccProcessingFee: 0.035,
  clientCommission: 0.05,
  gdpCommissionEnabled: true,
  gdpCommissionRate: 0.065,
  serviceChargeDefault: 0.20,
  gratuityDefault: 0.20,
  adminFeeDefault: 0.05,
};

const TEAM_HOURS_TIERS: TeamHoursTier[] = [
  { revenueThreshold: 0, baseHours: 5, tierName: 'Micro' },
  { revenueThreshold: 5000, baseHours: 10, tierName: 'Micro' },
  { revenueThreshold: 10000, baseHours: 20, tierName: 'Small' },
  { revenueThreshold: 15000, baseHours: 28, tierName: 'Small' },
  { revenueThreshold: 25000, baseHours: 40, tierName: 'Standard' },
];

// ─── Fee Parsing ─────────────────────────────────────────

describe('parseFeeRate', () => {
  it('returns numeric value as-is (20% stored as 0.20)', () => expect(parseFeeRate(0.20)).toBe(0.20));
  it('returns numeric value as-is (21.5% stored as 0.215)', () => expect(parseFeeRate(0.215)).toBe(0.215));
  it('returns numeric value as-is (5% stored as 0.05)', () => expect(parseFeeRate(0.05)).toBe(0.05));
  it('returns 0 for zero (None)', () => expect(parseFeeRate(0)).toBe(0));
  it('returns arbitrary value (7.3% stored as 0.073)', () => expect(parseFeeRate(0.073)).toBe(0.073));
});

// ─── Tax Rate Resolution ─────────────────────────────────

describe('getTaxRate', () => {
  it('returns food tax rate', () => {
    expect(getTaxRate('food', BASE_CONFIG)).toBe(0.0725);
  });
  it('returns alcohol tax rate', () => {
    expect(getTaxRate('alcohol', BASE_CONFIG)).toBe(0.0725);
  });
  it('returns general tax rate', () => {
    expect(getTaxRate('general', BASE_CONFIG)).toBe(0.0725);
  });
  it('returns 0 for none', () => {
    expect(getTaxRate('none', BASE_CONFIG)).toBe(0);
  });

  it('handles DC split rates', () => {
    const dcConfig: ProgramConfig = {
      ...BASE_CONFIG,
      location: {
        id: 'loc-dc',
        name: 'DC',
        foodTaxRate: 0.10,
        alcoholTaxRate: 0.1025,
        generalTaxRate: 0.06,
      },
    };
    expect(getTaxRate('food', dcConfig)).toBe(0.10);
    expect(getTaxRate('alcohol', dcConfig)).toBe(0.1025);
    expect(getTaxRate('general', dcConfig)).toBe(0.06);
  });
});

// ─── Line Item Calculation ───────────────────────────────

describe('calculateLineItem', () => {
  it('calculates food line item with 55% markup', () => {
    const item: LineItem = {
      id: '1',
      section: 'F&B',
      taxBucket: 'fb',
      name: 'Per Person Food',
      qty: 50,
      unitPrice: 50,
      categoryMarkupPct: 0.55,  // Catering & F&B
      taxType: 'food',
    };

    const result = calculateLineItem(item, BASE_CONFIG);

    expect(result.ourCost).toBe(2500);           // 50 × $50
    expect(result.clientCost).toBe(3875);         // 2500 × 1.55
    expect(result.taxRate).toBe(0.0725);
    expect(result.taxAmount).toBeCloseTo(280.9375);
  });

  it('calculates non-taxable line item', () => {
    const item: LineItem = {
      id: '2',
      section: 'Non-Taxable Staffing',
      taxBucket: 'staffing',
      name: 'QC Event Staff',
      qty: 1,
      unitPrice: 500,
      categoryMarkupPct: 0.90,  // Staffing & Labor
      taxType: 'none',
    };

    const result = calculateLineItem(item, BASE_CONFIG);

    expect(result.ourCost).toBe(500);
    expect(result.clientCost).toBe(950);          // 500 × 1.90
    expect(result.taxRate).toBe(0);
    expect(result.taxAmount).toBe(0);
  });
});

// ─── Revenue Items ────────────────────────────────────────

describe('calculateLineItem — revenue item', () => {
  const revenueItem: LineItem = {
    id: 'rev-1',
    section: 'Non-Taxable Staffing',
    taxBucket: 'staffing',
    name: 'Coordinator Fee',
    qty: 1,
    unitPrice: 500,
    categoryMarkupPct: 0.90,
    taxType: 'none',
    isRevenueItem: true,
  };

  it('sets ourCost to 0', () => {
    const result = calculateLineItem(revenueItem, BASE_CONFIG);
    expect(result.ourCost).toBe(0);
  });

  it('sets clientCost to qty × unitPrice (no markup)', () => {
    const result = calculateLineItem(revenueItem, BASE_CONFIG);
    expect(result.clientCost).toBe(500);  // 1 × 500, no 90% markup
  });

  it('applies tax to clientCost normally', () => {
    const taxableRevItem: LineItem = { ...revenueItem, taxType: 'general' };
    const result = calculateLineItem(taxableRevItem, BASE_CONFIG);
    expect(result.taxAmount).toBeCloseTo(500 * 0.0725);
  });

  it('does not inflate totalVendorCosts when added to an estimate', () => {
    const regularItem: LineItem = {
      id: 'r1', section: 'F&B', taxBucket: 'fb', name: 'Dinner', qty: 50, unitPrice: 50,
      categoryMarkupPct: 0.55, taxType: 'food',
    };
    const noCommConfig: ProgramConfig = {
      ...BASE_CONFIG, ccProcessingFee: 0, clientCommission: 0, gdpCommissionEnabled: false,
    };
    const base: VenueEstimateInput = {
      name: 'Test', fbMinimum: 0, isVenueTaxable: false,
      serviceCharge: 0, gratuity: 0, adminFee: 0, lineItems: [regularItem],
    };
    const withRev: VenueEstimateInput = { ...base, lineItems: [regularItem, revenueItem] };

    const summaryBase = calculateVenueEstimate(base, noCommConfig);
    const summaryWith = calculateVenueEstimate(withRev, noCommConfig);

    const marginBase = calculateMarginAnalysis(summaryBase, noCommConfig, TEAM_HOURS_TIERS, 0);
    const marginWith = calculateMarginAnalysis(summaryWith, noCommConfig, TEAM_HOURS_TIERS, 0);

    expect(marginWith.totalVendorCosts).toBeCloseTo(marginBase.totalVendorCosts, 2);
  });

  it('produces 100% QC margin when the only item is a revenue item with no commissions', () => {
    const noCommConfig: ProgramConfig = {
      ...BASE_CONFIG, ccProcessingFee: 0, clientCommission: 0, gdpCommissionEnabled: false,
    };
    const input: VenueEstimateInput = {
      name: 'Test', fbMinimum: 0, isVenueTaxable: false,
      serviceCharge: 0, gratuity: 0, adminFee: 0, lineItems: [revenueItem],
    };
    const summary = calculateVenueEstimate(input, noCommConfig);
    const margin = calculateMarginAnalysis(summary, noCommConfig, TEAM_HOURS_TIERS, 0);
    expect(margin.totalVendorCosts).toBe(0);
    expect(margin.qcMarginPct).toBeCloseTo(1.0);
  });
});

// ─── Venue Estimate (Excel validation) ───────────────────

describe('calculateVenueEstimate', () => {
  // This mirrors the "Beau Beau" sample from the Excel workbook
  const beaubeau: VenueEstimateInput = {
    name: 'Beau Beau',
    fbMinimum: 8000,
    isVenueTaxable: true,
    serviceCharge: 0.20,
    gratuity: 0.20,
    adminFee: 0.05,
    lineItems: [
      // F&B
      { id: '1', section: 'F&B', taxBucket: 'fb', name: 'Per Person Food', qty: 50, unitPrice: 50, categoryMarkupPct: 0.55, taxType: 'food' },
      { id: '2', section: 'F&B', taxBucket: 'fb', name: 'Bar Package', qty: 50, unitPrice: 50, categoryMarkupPct: 0.55, taxType: 'alcohol' },
      { id: '3', section: 'F&B', taxBucket: 'fb', name: 'NA Beverages', qty: 50, unitPrice: 8, categoryMarkupPct: 0.55, taxType: 'food' },
      // Equipment & Staffing
      { id: '4', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'Staffing', qty: 1, unitPrice: 200, categoryMarkupPct: 0.90, taxType: 'general' },
      { id: '5', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'Catering Equipment', qty: 1, unitPrice: 200, categoryMarkupPct: 0.65, taxType: 'general' },
      { id: '6', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'Rental Equipment', qty: 1, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'general' },
      { id: '7', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'Additional Equipment', qty: 1, unitPrice: 200, categoryMarkupPct: 0.65, taxType: 'general' },
      // Venue Fees
      { id: '8', section: 'Venue Fees', taxBucket: 'venue', name: 'Venue / Room Rental', qty: 1, unitPrice: 200, categoryMarkupPct: 0.60, taxType: 'general' },
      { id: '9', section: 'Venue Fees', taxBucket: 'venue', name: 'Additional Venue Space', qty: 1, unitPrice: 200, categoryMarkupPct: 0.60, taxType: 'general' },
      { id: '10', section: 'Venue Fees', taxBucket: 'venue', name: 'Additional Services', qty: 1, unitPrice: 200, categoryMarkupPct: 0.60, taxType: 'general' },
      // Non-Taxable Staffing
      { id: '11', section: 'Non-Taxable Staffing', taxBucket: 'staffing', name: 'QC Event Staff', qty: 1, unitPrice: 500, categoryMarkupPct: 0.90, taxType: 'none' },
      { id: '12', section: 'Non-Taxable Staffing', taxBucket: 'staffing', name: 'Fee', qty: 1, unitPrice: 10, categoryMarkupPct: 0.90, taxType: 'none' },
      { id: '13', section: 'Non-Taxable Staffing', taxBucket: 'staffing', name: 'Fee', qty: 1, unitPrice: 10, categoryMarkupPct: 0.90, taxType: 'none' },
    ],
  };

  it('calculates F&B subtotals correctly', () => {
    const result = calculateVenueEstimate(beaubeau, BASE_CONFIG);

    // Excel D43 = 5400 (50×50 + 50×50 + 50×8)
    expect(result.fbSubtotalOur).toBe(5400);
    // Excel E43 = 8370 (5400 × 1.55)
    expect(result.fbSubtotalClient).toBe(8370);
  });

  it('calculates food and alcohol tax correctly', () => {
    const result = calculateVenueEstimate(beaubeau, BASE_CONFIG);

    // Food tax: (2500 + 400) × 0.0725 for our cost = 210.25
    // Alcohol tax: 2500 × 0.0725 = 181.25
    // Client food tax: (3875 + 620) × 0.0725 = 325.8875
    // Client alcohol tax: 3875 × 0.0725 = 280.9375
    expect(result.foodTax).toBeCloseTo(325.8875);
    expect(result.alcoholTax).toBeCloseTo(280.9375);
  });

  it('calculates service charge, gratuity, admin fee correctly', () => {
    const result = calculateVenueEstimate(beaubeau, BASE_CONFIG);

    // Service charge 20% of F&B client subtotal: 8370 × 0.20 = 1674
    expect(result.serviceChargeClient).toBe(1674);
    // Gratuity 20%: 8370 × 0.20 = 1674
    expect(result.gratuityClient).toBe(1674);
    // Admin fee 5%: 8370 × 0.05 = 418.50
    expect(result.adminFeeClient).toBe(418.5);
  });

  it('F&B minimum is not met with shortfall', () => {
    const result = calculateVenueEstimate(beaubeau, BASE_CONFIG);

    // F&B our cost is 5400, minimum is 8000
    expect(result.fbMinimumMet).toBe(false);
    expect(result.fbShortfall).toBe(2600);
  });

  it('separates food vs alcohol F&B subtotals', () => {
    const result = calculateVenueEstimate(beaubeau, BASE_CONFIG);

    // Food: Per Person Food (3875) + NA Beverages (620) = 4495
    // Alcohol: Bar Package = 3875
    expect(result.fbFoodSubtotalClient).toBeCloseTo(4495);
    expect(result.fbAlcoholSubtotalClient).toBeCloseTo(3875);
    expect(result.fbFoodSubtotalClient + result.fbAlcoholSubtotalClient).toBeCloseTo(result.fbSubtotalClient);
  });
});

// ─── Margin Health ───────────────────────────────────────

describe('getMarginHealth', () => {
  it('returns STRONG for >= 35%', () => expect(getMarginHealth(0.35)).toBe('✓ STRONG'));
  it('returns ON TARGET for >= 28%', () => expect(getMarginHealth(0.30)).toBe('→ ON TARGET'));
  it('returns REVIEW for >= 22%', () => expect(getMarginHealth(0.24)).toBe('⚠ REVIEW'));
  it('returns BELOW FLOOR for < 22%', () => expect(getMarginHealth(0.15)).toBe('✗ BELOW FLOOR'));
});

describe('getNetHealth', () => {
  it('returns STRONG for >= 15%', () => expect(getNetHealth(0.15)).toBe('✓ STRONG'));
  it('returns ON TARGET for >= 7%', () => expect(getNetHealth(0.10)).toBe('→ ON TARGET'));
  it('returns THIN for >= 0%', () => expect(getNetHealth(0.03)).toBe('⚠ THIN'));
  it('returns LOSING MONEY for < 0%', () => expect(getNetHealth(-0.05)).toBe('✗ LOSING MONEY'));
});

// ─── Custom Client Cost Override ─────────────────────────

describe('calculateLineItem with clientCostOverride', () => {
  it('uses override as clientCost, skips markup formula', () => {
    const item: LineItem = {
      id: '99',
      section: 'F&B',
      taxBucket: 'fb',
      name: 'Custom Item',
      qty: 2,
      unitPrice: 100,
      categoryMarkupPct: 0.55,
      taxType: 'food',
      clientCostOverride: 300,  // user says total client cost is $300
    };
    const result = calculateLineItem(item, BASE_CONFIG);
    expect(result.ourCost).toBe(200);          // qty × unitPrice, unchanged
    expect(result.clientCost).toBe(300);       // override applied, not 200 × 1.55 = 310
    expect(result.taxAmount).toBeCloseTo(300 * 0.0725);
  });

  it('falls back to markup formula when override is undefined', () => {
    const item: LineItem = {
      id: '100',
      section: 'Equipment & Staffing',
      taxBucket: 'equipment',
      name: 'Regular Item',
      qty: 1,
      unitPrice: 200,
      categoryMarkupPct: 0.65,
      taxType: 'general',
    };
    const result = calculateLineItem(item, BASE_CONFIG);
    expect(result.clientCost).toBe(330);       // 200 × 1.65
  });
});

// ─── Decor Estimate Section Grouping ─────────────────────

describe('calculateVenueEstimate — decor sections', () => {
  it('groups decor taxable sections into equipment bucket', () => {
    const input: VenueEstimateInput = {
      name: 'Test Decor',
      fbMinimum: 0,
      isVenueTaxable: false,
      serviceCharge: 0,
      gratuity: 0,
      adminFee: 0,
      lineItems: [
        { id: '1', section: 'Florals - Taxable', taxBucket: 'equipment', name: 'Centerpieces', qty: 10, unitPrice: 100, categoryMarkupPct: 0.85, taxType: 'general' },
        { id: '2', section: 'Rentals - Seating', taxBucket: 'equipment', name: 'Chairs', qty: 50, unitPrice: 10, categoryMarkupPct: 0.85, taxType: 'general' },
        { id: '3', section: 'Rentals - Lounge', taxBucket: 'equipment', name: 'Sofa', qty: 1, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'general' },
        { id: '4', section: 'Florals - Non-Taxable', taxBucket: 'staffing', name: 'Delivery', qty: 1, unitPrice: 300, categoryMarkupPct: 0.85, taxType: 'none' },
        { id: '5', section: 'Rentals - Non-Taxable', taxBucket: 'staffing', name: 'Rental Delivery', qty: 1, unitPrice: 150, categoryMarkupPct: 0.85, taxType: 'none' },
      ],
    };

    const result = calculateVenueEstimate(input, BASE_CONFIG);

    // Taxable items: ourCost = 10×100 + 50×10 + 1×200 = 1700; clientCost = 1700 × 1.85 = 3145
    expect(result.equipmentSubtotalOur).toBeCloseTo(1700);
    expect(result.equipmentSubtotalClient).toBeCloseTo(3145);
    expect(result.equipmentTax).toBeCloseTo(3145 * 0.0725);

    // Non-taxable: ourCost = 300 + 150 = 450; clientCost = 450 × 1.85 = 832.5
    expect(result.qcStaffingSubtotalOur).toBeCloseTo(450);
    expect(result.qcStaffingSubtotalClient).toBeCloseTo(832.5);

    // No F&B, no venue, no restaurant fees
    expect(result.fbSubtotalClient).toBe(0);
    expect(result.venueSubtotalClient).toBe(0);
    expect(result.serviceChargeClient).toBe(0);
  });

  it('calculates correct totals for a decor estimate', () => {
    const input: VenueEstimateInput = {
      name: 'Simple Decor',
      fbMinimum: 0,
      isVenueTaxable: false,
      serviceCharge: 0,
      gratuity: 0,
      adminFee: 0,
      lineItems: [
        { id: '1', section: 'Rentals - Tables', taxBucket: 'equipment', name: 'Farm Tables', qty: 5, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'general' },
      ],
    };

    const result = calculateVenueEstimate(input, BASE_CONFIG);

    const ourCost = 5 * 200; // 1000
    const clientCost = ourCost * 1.85; // 1850
    const tax = clientCost * 0.0725; // 134.125
    const subtotalClient = clientCost + tax; // 1984.125
    const productionFee = subtotalClient * 0.035 + clientCost * 0.05;

    expect(result.equipmentSubtotalOur).toBe(1000);
    expect(result.equipmentSubtotalClient).toBe(1850);
    expect(result.equipmentTax).toBeCloseTo(134.125);
    expect(result.subtotalClient).toBeCloseTo(subtotalClient);
    expect(result.productionFee).toBeCloseTo(productionFee);
    const productionFeeTax = productionFee * BASE_CONFIG.location.generalTaxRate;
    expect(result.totalClient).toBeCloseTo(subtotalClient + productionFee + productionFeeTax);
  });
});

// ─── Margin Formula (new: CC pass-through, taxes pass-through, clientComm not deducted) ─────

describe('calculateMarginAnalysis — new formula', () => {
  // Farm Tables: 5 × $200 = ourCost $1000, markup 85% = clientCost $1850, general tax 7.25%
  const simpleDecorInput: VenueEstimateInput = {
    name: 'Simple Decor',
    fbMinimum: 0,
    isVenueTaxable: false,
    serviceCharge: 0,
    gratuity: 0,
    adminFee: 0,
    lineItems: [
      { id: '1', section: 'Rentals - Tables', taxBucket: 'equipment', name: 'Farm Tables', qty: 5, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'general' },
    ],
  };
  // Derived: equipmentTax=134.125, vendorTaxesTotal=72.5, subtotalClient=1984.125,
  // productionFee(BASE)=161.94375, totalClient=2146.06875

  it('vendorCostsBase equals sum of item ourCosts (vendor taxes excluded)', () => {
    const summary = calculateVenueEstimate(simpleDecorInput, BASE_CONFIG);
    const margin = calculateMarginAnalysis(summary, BASE_CONFIG, TEAM_HOURS_TIERS, 0);
    expect(margin.vendorCostsBase).toBeCloseTo(1000);
  });

  it('totalTaxes equals client-side taxes including productionFeeTax', () => {
    const summary = calculateVenueEstimate(simpleDecorInput, BASE_CONFIG);
    const margin = calculateMarginAnalysis(summary, BASE_CONFIG, TEAM_HOURS_TIERS, 0);
    // equipmentTax = 1850 × 0.0725 = 134.125
    // productionFeeTax = productionFee × 0.0725 ≈ 11.741
    expect(margin.totalTaxes).toBeCloseTo(summary.equipmentTax + summary.productionFeeTax);
  });

  it('ccProcessingAmount = subtotalClient × ccRate', () => {
    const summary = calculateVenueEstimate(simpleDecorInput, BASE_CONFIG);
    const margin = calculateMarginAnalysis(summary, BASE_CONFIG, TEAM_HOURS_TIERS, 0);
    // subtotalClient = 1984.125, ccRate = 3.5%
    expect(margin.ccProcessingAmount).toBeCloseTo(1984.125 * 0.035);
  });

  it('qcRevenue = totalClient − vendorCostsBase − totalTaxes − ccProcessing − clientComm − gdpComm', () => {
    const summary = calculateVenueEstimate(simpleDecorInput, BASE_CONFIG);
    const margin = calculateMarginAnalysis(summary, BASE_CONFIG, TEAM_HOURS_TIERS, 0);
    const expected = summary.totalClient
      - margin.vendorCostsBase - margin.totalTaxes
      - margin.ccProcessingAmount - margin.clientCommissionAmount - margin.gdpCommissionAmount;
    expect(margin.qcRevenue).toBeCloseTo(expected);
    // Updated for production fee tax: GDP base is larger by productionFeeTax → qcRevenue decreases
    // productionFeeTax ≈ 11.741, GDP at 6.5% takes 0.763 → ~709.75
    expect(margin.qcRevenue).toBeCloseTo(709.74);
  });

  it('client commission cancels exactly — qcRevenue is independent of commission rate', () => {
    const noGdpHigh: ProgramConfig = { ...BASE_CONFIG, gdpCommissionEnabled: false, clientCommission: 0.10 };
    const noGdpZero: ProgramConfig = { ...BASE_CONFIG, gdpCommissionEnabled: false, clientCommission: 0 };

    const marginHigh = calculateMarginAnalysis(
      calculateVenueEstimate(simpleDecorInput, noGdpHigh), noGdpHigh, TEAM_HOURS_TIERS, 0,
    );
    const marginZero = calculateMarginAnalysis(
      calculateVenueEstimate(simpleDecorInput, noGdpZero), noGdpZero, TEAM_HOURS_TIERS, 0,
    );

    // clientCommission adds to totalClient (via productionFee) and is also deducted — they cancel exactly
    expect(marginHigh.qcRevenue).toBeCloseTo(marginZero.qcRevenue);
  });

  it('taxes are a pure pass-through (no GDP) — qcRevenue identical at 0% and 10% tax rates', () => {
    const zeroTaxConfig: ProgramConfig = {
      ...BASE_CONFIG,
      gdpCommissionEnabled: false,
      location: { id: 'z', name: 'No Tax', foodTaxRate: 0, alcoholTaxRate: 0, generalTaxRate: 0 },
    };
    const highTaxConfig: ProgramConfig = {
      ...BASE_CONFIG,
      gdpCommissionEnabled: false,
      location: { id: 'h', name: 'High Tax', foodTaxRate: 0.10, alcoholTaxRate: 0.10, generalTaxRate: 0.10 },
    };

    const marginZero = calculateMarginAnalysis(
      calculateVenueEstimate(simpleDecorInput, zeroTaxConfig), zeroTaxConfig, TEAM_HOURS_TIERS, 0,
    );
    const marginHigh = calculateMarginAnalysis(
      calculateVenueEstimate(simpleDecorInput, highTaxConfig), highTaxConfig, TEAM_HOURS_TIERS, 0,
    );

    // Taxes pass through when GDP is off; with GDP on, higher taxes raise totalClient → higher GDP commission
    expect(marginZero.qcRevenue).toBeCloseTo(marginHigh.qcRevenue);
  });

  it('totalVendorCosts field equals vendorCostsBase', () => {
    const summary = calculateVenueEstimate(simpleDecorInput, BASE_CONFIG);
    const margin = calculateMarginAnalysis(summary, BASE_CONFIG, TEAM_HOURS_TIERS, 0);
    expect(margin.totalVendorCosts).toBeCloseTo(margin.vendorCostsBase);
  });

  it('EstimateSummary exposes vendorTaxesTotal = sum of vendor-side taxes', () => {
    const summary = calculateVenueEstimate(simpleDecorInput, BASE_CONFIG);
    // equipmentTaxOur = 1000 × 0.0725 = 72.5
    expect(summary.vendorTaxesTotal).toBeCloseTo(72.5);
  });
});

// ─── Bug #5: GDP base fix + clientCommission deduction ───────────────────────
// Real estimate (May 2026): app showed Commissions $0, Margin $901 (41%).
// Two bugs: (1) GDP used markupRevenue base instead of totalClient,
//           (2) clientCommissionAmount was not deducted from qcRevenue.
// Expected after fix: commissions deducted, Margin ≈ $697.

describe('calculateMarginAnalysis — bug #5: GDP base and clientCommission deduction', () => {
  const avInput: VenueEstimateInput = {
    name: 'AV estimate',
    fbMinimum: 0, isVenueTaxable: false, serviceCharge: 0, gratuity: 0, adminFee: 0,
    lineItems: [
      { id: '1', section: 'AV & Production', taxBucket: 'equipment', name: 'LED Wall', qty: 1, unitPrice: 1000, categoryMarkupPct: 0.65, taxType: 'none' },
    ],
  };

  const avConfig: ProgramConfig = {
    guestCount: 100,
    location: { id: 'loc', name: 'Test', foodTaxRate: 0, alcoholTaxRate: 0, generalTaxRate: 0 },
    ccProcessingFee: 0,
    clientCommission: 0.03,
    gdpCommissionEnabled: true,
    gdpCommissionRate: 0.065,
    serviceChargeDefault: 0, gratuityDefault: 0, adminFeeDefault: 0,
    thirdPartyCommissions: [],
  };

  // ourCost=1000, clientCost=1650, markupRevenue=1650
  // productionFee = 1650 × 0.03 = 49.50
  // totalClient = 1699.50
  // GDP (correct) = 1699.50 × 0.065 = 110.47
  // clientCommissionAmount = 49.50
  // qcRevenue = 1699.50 − 1000 − 0 − 0 − 49.50 − 110.47 = 539.53
  //           = markup(650) − GDP(110.47)

  it('gdpCommissionAmount uses totalClient as base, not markupRevenue', () => {
    const summary = calculateVenueEstimate(avInput, avConfig);
    const margin = calculateMarginAnalysis(summary, avConfig, TEAM_HOURS_TIERS, 0);
    expect(margin.gdpCommissionAmount).toBeCloseTo(summary.totalClient * avConfig.gdpCommissionRate);
    expect(margin.gdpCommissionAmount).not.toBeCloseTo(1650 * avConfig.gdpCommissionRate);
  });

  it('clientCommissionAmount is deducted from qcRevenue', () => {
    const summary = calculateVenueEstimate(avInput, avConfig);
    const margin = calculateMarginAnalysis(summary, avConfig, TEAM_HOURS_TIERS, 0);
    const expected = summary.totalClient
      - margin.vendorCostsBase - margin.totalTaxes
      - margin.ccProcessingAmount - margin.clientCommissionAmount
      - margin.gdpCommissionAmount - margin.thirdPartyCommissionsTotal;
    expect(margin.qcRevenue).toBeCloseTo(expected);
  });

  it('qcRevenue equals markup minus GDP (algebraic identity, no taxes, ccFee=0)', () => {
    const summary = calculateVenueEstimate(avInput, avConfig);
    const margin = calculateMarginAnalysis(summary, avConfig, TEAM_HOURS_TIERS, 0);
    const markup = summary.equipmentSubtotalClient - summary.equipmentSubtotalOur;
    expect(margin.qcRevenue).toBeCloseTo(markup - margin.gdpCommissionAmount);
    expect(margin.qcRevenue).toBeCloseTo(539.53);
  });

  it('gdpCommissionAmount and clientCommissionAmount are both non-zero', () => {
    const summary = calculateVenueEstimate(avInput, avConfig);
    const margin = calculateMarginAnalysis(summary, avConfig, TEAM_HOURS_TIERS, 0);
    expect(margin.gdpCommissionAmount).toBeGreaterThan(0);
    expect(margin.clientCommissionAmount).toBeGreaterThan(0);
  });

  it('qcMarginPct is lower when GDP is enabled', () => {
    const noGdpConfig: ProgramConfig = { ...avConfig, gdpCommissionEnabled: false };
    const summaryGdp    = calculateVenueEstimate(avInput, avConfig);
    const summaryNoGdp  = calculateVenueEstimate(avInput, noGdpConfig);
    const marginGdp     = calculateMarginAnalysis(summaryGdp, avConfig, TEAM_HOURS_TIERS, 0);
    const marginNoGdp   = calculateMarginAnalysis(summaryNoGdp, noGdpConfig, TEAM_HOURS_TIERS, 0);
    expect(marginGdp.qcMarginPct).toBeLessThan(marginNoGdp.qcMarginPct);
  });
});

// ─── Team Hours Lookup ───────────────────────────────────

describe('lookupTeamHours', () => {
  it('returns correct hours for revenue in Small tier', () => {
    expect(lookupTeamHours(17000, TEAM_HOURS_TIERS)).toBe(28);
  });
  it('returns minimum hours for 0 revenue', () => {
    expect(lookupTeamHours(0, TEAM_HOURS_TIERS)).toBe(5);
  });
  it('returns highest matching tier', () => {
    expect(lookupTeamHours(30000, TEAM_HOURS_TIERS)).toBe(40);
  });
});

// ─── Client Discount ─────────────────────────────────────

describe('client discount', () => {
  // Single general-taxable item: ourCost=$1000, markup=85%, clientCost=$1850
  // equipmentSubtotalClient = 1850, tax = 1850×0.0725 = 134.125
  // subtotalClient = 1850 + 134.125 = 1984.125
  // productionFee = 1984.125×0.035 + (1984.125 - 134.125)×0.05
  //               = 69.44... + 1850×0.05 = 69.44 + 92.5 = 161.94...
  // totalClientPreDiscount = 1984.125 + 161.94... ≈ 2146.07
  const baseInput: VenueEstimateInput = {
    name: 'Discount Test',
    fbMinimum: 0, isVenueTaxable: false, serviceCharge: 0, gratuity: 0, adminFee: 0,
    lineItems: [
      { id: 'a', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'Item A', qty: 1, unitPrice: 1000, categoryMarkupPct: 0.85, taxType: 'general', isRevenueItem: false },
    ],
  };
  const noDiscountConfig: ProgramConfig = { ...BASE_CONFIG, gdpCommissionEnabled: false, clientCommission: 0.05 };

  it('discountAmount is 0 when no discount', () => {
    const s = calculateVenueEstimate(baseInput, noDiscountConfig);
    expect(s.discountAmount).toBe(0);
    expect(s.totalClient).toBeCloseTo(s.subtotalClient + s.productionFee + s.productionFeeTax);
  });

  it('flat discount reduces totalClient by exact amount', () => {
    const input = { ...baseInput, discount: { type: 'flat' as const, value: 200 } };
    const s = calculateVenueEstimate(input, noDiscountConfig);
    expect(s.discountAmount).toBe(200);
    // totalClient = (subtotalClient + productionFee + productionFeeTax) − discountAmount
    const preDiscount = s.subtotalClient + s.productionFee + s.productionFeeTax;
    expect(s.totalClient).toBeCloseTo(preDiscount - 200);
  });

  it('percent discount reduces totalClient by correct proportion', () => {
    const input = { ...baseInput, discount: { type: 'percent' as const, value: 0.10 } };
    const s = calculateVenueEstimate(input, noDiscountConfig);
    const noDiscount = calculateVenueEstimate(baseInput, noDiscountConfig);
    const preDiscount = noDiscount.subtotalClient + noDiscount.productionFee + noDiscount.productionFeeTax;
    expect(s.discountAmount).toBeCloseTo(preDiscount * 0.10);
    expect(s.totalClient).toBeCloseTo(preDiscount * 0.90);
  });

  it('discount does not affect equipmentSubtotalClient or productionFee', () => {
    const flat = calculateVenueEstimate({ ...baseInput, discount: { type: 'flat' as const, value: 300 } }, noDiscountConfig);
    const none = calculateVenueEstimate(baseInput, noDiscountConfig);
    expect(flat.equipmentSubtotalClient).toBeCloseTo(none.equipmentSubtotalClient);
    expect(flat.productionFee).toBeCloseTo(none.productionFee);
  });

  it('discount reduces qcRevenue by the discount amount', () => {
    const flat = calculateVenueEstimate({ ...baseInput, discount: { type: 'flat' as const, value: 250 } }, noDiscountConfig);
    const none = calculateVenueEstimate(baseInput, noDiscountConfig);
    const mFlat = calculateMarginAnalysis(flat, noDiscountConfig, TEAM_HOURS_TIERS, 0);
    const mNone = calculateMarginAnalysis(none, noDiscountConfig, TEAM_HOURS_TIERS, 0);
    expect(mNone.qcRevenue - mFlat.qcRevenue).toBeCloseTo(250);
  });

  it('zero discount value behaves identically to no discount', () => {
    const zeroDiscount = calculateVenueEstimate({ ...baseInput, discount: { type: 'percent' as const, value: 0 } }, noDiscountConfig);
    const noDiscount = calculateVenueEstimate(baseInput, noDiscountConfig);
    // Note: discount.value = 0 still computes discountAmount as 0
    expect(zeroDiscount.totalClient).toBeCloseTo(noDiscount.totalClient);
    expect(zeroDiscount.discountAmount).toBe(0);
  });

  it('null discount input behaves identically to no discount', () => {
    const nullDiscount = calculateVenueEstimate({ ...baseInput, discount: null }, noDiscountConfig);
    const noDiscount = calculateVenueEstimate(baseInput, noDiscountConfig);
    expect(nullDiscount.totalClient).toBeCloseTo(noDiscount.totalClient);
    expect(nullDiscount.discountAmount).toBe(0);
  });
});

// ─── Category Move (client-side logic) ───────────────────
// Category move is UI state logic — when an item moves to a new section both
// its section and taxType are updated. These tests verify the engine correctly
// prices items after those updates.
//
// Engine tax model:
//  - F&B items: individual taxType matters (food → foodTaxRate, alcohol → alcoholTaxRate)
//  - Equipment items ('Equipment & Staffing' + Decor taxable): blanket generalTaxRate
//    applied to the whole equipmentSubtotalClient bucket
//  - Non-taxable items ('Non-Taxable Staffing' + Decor non-taxable): no tax

describe('category move: taxType changes with section', () => {
  const splitTaxConfig: ProgramConfig = {
    ...BASE_CONFIG,
    location: { id: 't', name: 'Test', foodTaxRate: 0.10, alcoholTaxRate: 0.08, generalTaxRate: 0.07 },
    gdpCommissionEnabled: false,
    clientCommission: 0,
    ccProcessingFee: 0,
  };

  it('moving item from F&B (food) to Equipment & Staffing changes from foodTax to equipmentTax', () => {
    // F&B taxType='food' → foodTax = clientCost × foodTaxRate; equipmentTax = 0
    // Equipment taxType='general' → foodTax = 0; equipmentTax = clientCost × generalTaxRate
    const fbInput: VenueEstimateInput = {
      name: 'Move Test',
      fbMinimum: 0, isVenueTaxable: false, serviceCharge: 0, gratuity: 0, adminFee: 0,
      lineItems: [
        { id: 'x', section: 'F&B', taxBucket: 'fb', name: 'Item', qty: 1, unitPrice: 1000, categoryMarkupPct: 0.55, taxType: 'food', isRevenueItem: false },
      ],
    };
    const equipInput: VenueEstimateInput = {
      ...fbInput,
      lineItems: [
        { id: 'x', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'Item', qty: 1, unitPrice: 1000, categoryMarkupPct: 0.55, taxType: 'general', isRevenueItem: false },
      ],
    };
    const fbSummary = calculateVenueEstimate(fbInput, splitTaxConfig);
    const equipSummary = calculateVenueEstimate(equipInput, splitTaxConfig);
    const clientCost = 1000 * 1.55; // = 1550
    // F&B: foodTax = 1550 × 10%, equipmentTax = 0
    expect(fbSummary.foodTax).toBeCloseTo(clientCost * 0.10);
    expect(fbSummary.equipmentTax).toBe(0);
    // Equipment: equipmentTax = 1550 × 7%, foodTax = 0
    expect(equipSummary.equipmentTax).toBeCloseTo(clientCost * 0.07);
    expect(equipSummary.foodTax).toBe(0);
  });

  it('moving item from Equipment to Non-Taxable Staffing removes equipment tax', () => {
    // AV item: 1 × $500 × 1.65 = $825 clientCost
    const taxableInput: VenueEstimateInput = {
      name: 'Tax Test',
      fbMinimum: 0, isVenueTaxable: false, serviceCharge: 0, gratuity: 0, adminFee: 0,
      lineItems: [
        { id: 'y', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'AV', qty: 1, unitPrice: 500, categoryMarkupPct: 0.65, taxType: 'general', isRevenueItem: false },
      ],
    };
    const nonTaxableInput: VenueEstimateInput = {
      ...taxableInput,
      lineItems: [
        { id: 'y', section: 'Non-Taxable Staffing', taxBucket: 'staffing', name: 'AV', qty: 1, unitPrice: 500, categoryMarkupPct: 0.65, taxType: 'none', isRevenueItem: false },
      ],
    };
    const taxable = calculateVenueEstimate(taxableInput, splitTaxConfig);
    const nonTaxable = calculateVenueEstimate(nonTaxableInput, splitTaxConfig);
    const clientCost = 500 * 1.65; // = 825
    expect(taxable.equipmentTax).toBeCloseTo(clientCost * 0.07);
    expect(nonTaxable.equipmentTax).toBe(0);
    // Item moved to qcStaffing bucket — client cost preserved
    expect(taxable.equipmentSubtotalClient).toBeCloseTo(clientCost);
    expect(nonTaxable.qcStaffingSubtotalClient).toBeCloseTo(clientCost);
    expect(nonTaxable.equipmentSubtotalClient).toBe(0);
  });

  it('moving between Decor sections: Florals-Taxable → Florals-Non-Taxable removes tax', () => {
    // Flowers: 3 × $200 × 1.85 = $1110 clientCost
    const taxableInput: VenueEstimateInput = {
      name: 'Floral Move',
      fbMinimum: 0, isVenueTaxable: false, serviceCharge: 0, gratuity: 0, adminFee: 0,
      lineItems: [
        { id: 'z', section: 'Florals - Taxable', taxBucket: 'equipment', name: 'Flowers', qty: 3, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'general', isRevenueItem: false },
      ],
    };
    const nonTaxableInput: VenueEstimateInput = {
      ...taxableInput,
      lineItems: [
        { id: 'z', section: 'Florals - Non-Taxable', taxBucket: 'staffing', name: 'Flowers', qty: 3, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'none', isRevenueItem: false },
      ],
    };
    const before = calculateVenueEstimate(taxableInput, splitTaxConfig);
    const after = calculateVenueEstimate(nonTaxableInput, splitTaxConfig);
    const clientCost = 3 * 200 * 1.85; // = 1110
    // Tax removed when moved to non-taxable; client cost preserved in qcStaffing bucket
    expect(before.equipmentTax).toBeCloseTo(clientCost * 0.07);
    expect(after.equipmentTax).toBe(0);
    expect(before.equipmentSubtotalClient).toBeCloseTo(clientCost);
    expect(after.qcStaffingSubtotalClient).toBeCloseTo(clientCost);
  });
});

// ─── Production Fee Tax (Issue 2) ────────────────────────
// Production fee is now taxed at the location's general sales rate.
// Pre-Tax Total = lineItemsSubtotalClient + productionFee (before all taxes).

describe('calculateVenueEstimate — production fee tax', () => {
  // Farm Tables: equipmentSubtotalClient=1850, equipmentTax=134.125
  // subtotalClient=1984.125, markupRevenue=1850
  // productionFee = 1984.125×0.035 + 1850×0.05 = 69.444375 + 92.5 = 161.944375
  // productionFeeTax = 161.944375 × 0.0725 ≈ 11.741
  const simpleInput: VenueEstimateInput = {
    name: 'Prod Fee Tax Test',
    fbMinimum: 0, isVenueTaxable: false, serviceCharge: 0, gratuity: 0, adminFee: 0,
    lineItems: [
      { id: '1', section: 'Equipment', taxBucket: 'equipment', name: 'Farm Tables', qty: 5, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'general' },
    ],
  };

  it('productionFeeTax = productionFee × generalTaxRate', () => {
    const s = calculateVenueEstimate(simpleInput, BASE_CONFIG);
    expect(s.productionFeeTax).toBeCloseTo(s.productionFee * BASE_CONFIG.location.generalTaxRate);
  });

  it('lineItemsSubtotalClient equals sum of item client costs (no taxes)', () => {
    const s = calculateVenueEstimate(simpleInput, BASE_CONFIG);
    // lineItemsSubtotalClient = equipmentSubtotalClient (no F&B, staffing, venue, or restaurant fees)
    expect(s.lineItemsSubtotalClient).toBeCloseTo(1850);
  });

  it('preTaxTotal = lineItemsSubtotalClient + productionFee', () => {
    const s = calculateVenueEstimate(simpleInput, BASE_CONFIG);
    expect(s.preTaxTotal).toBeCloseTo(s.lineItemsSubtotalClient + s.productionFee);
  });

  it('totalClient = preTaxTotal + all taxes (including productionFeeTax)', () => {
    const s = calculateVenueEstimate(simpleInput, BASE_CONFIG);
    const allTaxes = s.foodTax + s.alcoholTax + s.equipmentTax + s.venueTax + s.productionFeeTax;
    expect(s.totalClient).toBeCloseTo(s.preTaxTotal + allTaxes - s.discountAmount);
  });

  it('productionFeeTax = 0 when taxExempt', () => {
    const s = calculateVenueEstimate({ ...simpleInput, taxExempt: true }, BASE_CONFIG);
    expect(s.productionFeeTax).toBe(0);
  });

  it('calculateMarginAnalysis totalTaxes includes productionFeeTax', () => {
    const s = calculateVenueEstimate(simpleInput, BASE_CONFIG);
    const margin = calculateMarginAnalysis(s, BASE_CONFIG, TEAM_HOURS_TIERS, 0);
    const expected = s.foodTax + s.alcoholTax + s.equipmentTax + s.venueTax + s.productionFeeTax;
    expect(margin.totalTaxes).toBeCloseTo(expected);
  });

  it('lineItemsSubtotalClient with service charge includes the charge', () => {
    const withSC: VenueEstimateInput = {
      name: 'SC Test',
      fbMinimum: 0, isVenueTaxable: false, serviceCharge: 0.20, gratuity: 0, adminFee: 0,
      lineItems: [
        { id: 'f1', section: 'F&B', taxBucket: 'fb', name: 'Food', qty: 10, unitPrice: 50, categoryMarkupPct: 0.55, taxType: 'food' },
      ],
    };
    const s = calculateVenueEstimate(withSC, BASE_CONFIG);
    // fbSubtotalClient = 10×50×1.55 = 775
    // serviceChargeClient = 775 × 0.20 = 155
    // lineItemsSubtotalClient = 775 + 155 = 930 (no taxes)
    expect(s.lineItemsSubtotalClient).toBeCloseTo(930);
  });
});

// ─── Tax Exempt ───────────────────────────────────────────

describe('calculateVenueEstimate — taxExempt', () => {
  const taxableInput: VenueEstimateInput = {
    name: 'Exempt Test',
    fbMinimum: 0,
    isVenueTaxable: true,
    serviceCharge: 0.20,
    gratuity: 0,
    adminFee: 0,
    lineItems: [
      { id: '1', section: 'F&B', taxBucket: 'fb', name: 'Food', qty: 10, unitPrice: 100, categoryMarkupPct: 0.55, taxType: 'food' },
      { id: '2', section: 'F&B', taxBucket: 'fb', name: 'Bar', qty: 10, unitPrice: 50, categoryMarkupPct: 0.55, taxType: 'alcohol' },
      { id: '3', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'AV', qty: 1, unitPrice: 500, categoryMarkupPct: 0.65, taxType: 'general' },
      { id: '4', section: 'Venue Fees', taxBucket: 'venue', name: 'Room', qty: 1, unitPrice: 1000, categoryMarkupPct: 0.60, taxType: 'general' },
      { id: '5', section: 'Non-Taxable Staffing', taxBucket: 'staffing', name: 'Staff', qty: 1, unitPrice: 200, categoryMarkupPct: 0.90, taxType: 'none' },
    ],
  };

  it('all tax fields are zero when taxExempt is true', () => {
    const result = calculateVenueEstimate({ ...taxableInput, taxExempt: true }, BASE_CONFIG);
    expect(result.foodTax).toBe(0);
    expect(result.alcoholTax).toBe(0);
    expect(result.equipmentTax).toBe(0);
    expect(result.venueTax).toBe(0);
    expect(result.vendorTaxesTotal).toBe(0);
  });

  it('line item costs are unchanged by taxExempt (only tax is zeroed)', () => {
    const exempt = calculateVenueEstimate({ ...taxableInput, taxExempt: true }, BASE_CONFIG);
    const normal = calculateVenueEstimate({ ...taxableInput, taxExempt: false }, BASE_CONFIG);
    expect(exempt.fbSubtotalClient).toBeCloseTo(normal.fbSubtotalClient);
    expect(exempt.equipmentSubtotalClient).toBeCloseTo(normal.equipmentSubtotalClient);
    expect(exempt.venueSubtotalClient).toBeCloseTo(normal.venueSubtotalClient);
  });

  it('totalClient is lower when taxExempt (taxes excluded from billing)', () => {
    const exempt = calculateVenueEstimate({ ...taxableInput, taxExempt: true }, BASE_CONFIG);
    const normal = calculateVenueEstimate({ ...taxableInput, taxExempt: false }, BASE_CONFIG);
    expect(exempt.totalClient).toBeLessThan(normal.totalClient);
  });

  it('taxExempt=false behaves identically to omitting the flag', () => {
    const withFalse = calculateVenueEstimate({ ...taxableInput, taxExempt: false }, BASE_CONFIG);
    const withOmit = calculateVenueEstimate(taxableInput, BASE_CONFIG);
    expect(withFalse.totalClient).toBeCloseTo(withOmit.totalClient);
    expect(withFalse.foodTax).toBeCloseTo(withOmit.foodTax);
  });

  it('margin totalTaxes is zero when taxExempt is true', () => {
    const summary = calculateVenueEstimate({ ...taxableInput, taxExempt: true }, BASE_CONFIG);
    const margin = calculateMarginAnalysis(summary, BASE_CONFIG, TEAM_HOURS_TIERS, 0);
    expect(margin.totalTaxes).toBe(0);
  });

  it('qcRevenue is higher when taxExempt because client total is lower but vendor costs are unchanged', () => {
    const exemptSummary = calculateVenueEstimate({ ...taxableInput, taxExempt: true }, BASE_CONFIG);
    const normalSummary = calculateVenueEstimate({ ...taxableInput, taxExempt: false }, BASE_CONFIG);
    const noCommConfig: ProgramConfig = { ...BASE_CONFIG, ccProcessingFee: 0, clientCommission: 0, gdpCommissionEnabled: false };
    const exemptMargin = calculateMarginAnalysis(exemptSummary, noCommConfig, TEAM_HOURS_TIERS, 0);
    const normalMargin = calculateMarginAnalysis(normalSummary, noCommConfig, TEAM_HOURS_TIERS, 0);
    expect(exemptMargin.vendorCostsBase).toBeCloseTo(normalMargin.vendorCostsBase);
  });

  it('tax-exempt estimate with high-tax location still shows zero tax', () => {
    const highTaxConfig: ProgramConfig = {
      ...BASE_CONFIG,
      location: { id: 'h', name: 'High Tax', foodTaxRate: 0.15, alcoholTaxRate: 0.15, generalTaxRate: 0.15 },
    };
    const result = calculateVenueEstimate({ ...taxableInput, taxExempt: true }, highTaxConfig);
    expect(result.foodTax).toBe(0);
    expect(result.alcoholTax).toBe(0);
    expect(result.equipmentTax).toBe(0);
    expect(result.venueTax).toBe(0);
  });
});

// ─── TaxBucket routing ───────────────────────────────────
// These tests verify that bucket assignment (fb/equipment/venue/staffing) is
// driven by taxBucket — not the section display name. They pass before the
// engine refactor (section strings still match) and remain passing after
// (engine switches to taxBucket). Custom-name tests marked with a comment
// will ONLY pass after the engine refactor.

describe('taxBucket routing', () => {
  const zeroFees = { fbMinimum: 0, isVenueTaxable: false, serviceCharge: 0, gratuity: 0, adminFee: 0 };
  const noTaxConfig: ProgramConfig = { ...BASE_CONFIG, ccProcessingFee: 0, clientCommission: 0, gdpCommissionEnabled: false };

  it('fb bucket contributes to fbSubtotalClient', () => {
    const input: VenueEstimateInput = {
      name: 'test', ...zeroFees,
      lineItems: [
        { id: '1', section: 'F&B', taxBucket: 'fb', name: 'Food', qty: 1, unitPrice: 100, categoryMarkupPct: 0.55, taxType: 'food' },
      ],
    };
    const s = calculateVenueEstimate(input, noTaxConfig);
    expect(s.fbSubtotalClient).toBeCloseTo(155);
    expect(s.equipmentSubtotalClient).toBe(0);
    expect(s.venueSubtotalClient).toBe(0);
    expect(s.qcStaffingSubtotalClient).toBe(0);
  });

  it('equipment bucket contributes to equipmentSubtotalClient and incurs general tax', () => {
    const input: VenueEstimateInput = {
      name: 'test', ...zeroFees,
      lineItems: [
        { id: '1', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'AV', qty: 1, unitPrice: 100, categoryMarkupPct: 0.65, taxType: 'general' },
      ],
    };
    const s = calculateVenueEstimate(input, BASE_CONFIG);
    expect(s.equipmentSubtotalClient).toBeCloseTo(165);
    expect(s.equipmentTax).toBeCloseTo(165 * 0.0725);
    expect(s.fbSubtotalClient).toBe(0);
    expect(s.venueSubtotalClient).toBe(0);
  });

  it('venue bucket contributes to venueSubtotalClient', () => {
    const input: VenueEstimateInput = {
      name: 'test', ...zeroFees, isVenueTaxable: true,
      lineItems: [
        { id: '1', section: 'Venue Fees', taxBucket: 'venue', name: 'Room', qty: 1, unitPrice: 100, categoryMarkupPct: 0.60, taxType: 'general' },
      ],
    };
    const s = calculateVenueEstimate(input, BASE_CONFIG);
    expect(s.venueSubtotalClient).toBeCloseTo(160);
    expect(s.venueTax).toBeCloseTo(160 * 0.0725);
    expect(s.fbSubtotalClient).toBe(0);
    expect(s.equipmentSubtotalClient).toBe(0);
  });

  it('staffing bucket contributes to qcStaffingSubtotalClient with no tax', () => {
    const input: VenueEstimateInput = {
      name: 'test', ...zeroFees,
      lineItems: [
        { id: '1', section: 'Non-Taxable Staffing', taxBucket: 'staffing', name: 'Staff', qty: 1, unitPrice: 100, categoryMarkupPct: 0.90, taxType: 'none' },
      ],
    };
    const s = calculateVenueEstimate(input, noTaxConfig);
    expect(s.qcStaffingSubtotalClient).toBeCloseTo(190);
    expect(s.equipmentTax).toBe(0);
    expect(s.foodTax).toBe(0);
    expect(s.venueTax).toBe(0);
  });

  it('mixed buckets sum correctly', () => {
    const input: VenueEstimateInput = {
      name: 'test', ...zeroFees,
      lineItems: [
        { id: '1', section: 'F&B', taxBucket: 'fb', name: 'Food', qty: 1, unitPrice: 100, categoryMarkupPct: 0.55, taxType: 'food' },
        { id: '2', section: 'Equipment & Staffing', taxBucket: 'equipment', name: 'AV', qty: 1, unitPrice: 200, categoryMarkupPct: 0.65, taxType: 'general' },
        { id: '3', section: 'Venue Fees', taxBucket: 'venue', name: 'Room', qty: 1, unitPrice: 300, categoryMarkupPct: 0.60, taxType: 'none' },
        { id: '4', section: 'Non-Taxable Staffing', taxBucket: 'staffing', name: 'Staff', qty: 1, unitPrice: 400, categoryMarkupPct: 0.90, taxType: 'none' },
      ],
    };
    const s = calculateVenueEstimate(input, noTaxConfig);
    expect(s.fbSubtotalClient).toBeCloseTo(155);
    expect(s.equipmentSubtotalClient).toBeCloseTo(330);
    expect(s.venueSubtotalClient).toBeCloseTo(480);
    expect(s.qcStaffingSubtotalClient).toBeCloseTo(760);
  });
});

// ─── Tax Rate Overrides ───────────────────────────────────

describe('calculateVenueEstimate — tax overrides', () => {
  const FOOD_ITEM: LineItem = {
    id: 'f1', section: 'F&B', taxBucket: 'fb', name: 'Food',
    qty: 1, unitPrice: 1000, categoryMarkupPct: 0.55, taxType: 'food',
  };
  const ALCOHOL_ITEM: LineItem = {
    id: 'a1', section: 'F&B', taxBucket: 'fb', name: 'Bar',
    qty: 1, unitPrice: 1000, categoryMarkupPct: 0.55, taxType: 'alcohol',
  };
  const EQUIPMENT_ITEM: LineItem = {
    id: 'e1', section: 'AV', taxBucket: 'equipment', name: 'AV Gear',
    qty: 1, unitPrice: 1000, categoryMarkupPct: 0.65, taxType: 'general',
  };
  const NO_COMM_CONFIG: ProgramConfig = {
    ...BASE_CONFIG,
    ccProcessingFee: 0, clientCommission: 0, gdpCommissionEnabled: false,
    serviceChargeDefault: 0, gratuityDefault: 0, adminFeeDefault: 0,
  };
  const BASE_INPUT: VenueEstimateInput = {
    name: 'Override Test', fbMinimum: 0, isVenueTaxable: false,
    serviceCharge: 0, gratuity: 0, adminFee: 0, lineItems: [],
  };

  it('no override: food tax uses location default 7.25%', () => {
    const input: VenueEstimateInput = { ...BASE_INPUT, lineItems: [FOOD_ITEM] };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    expect(s.foodTax).toBeCloseTo(1550 * 0.0725);
  });

  it('foodTaxOverride replaces default for food items', () => {
    const input: VenueEstimateInput = { ...BASE_INPUT, lineItems: [FOOD_ITEM], foodTaxOverride: 0.10 };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    expect(s.foodTax).toBeCloseTo(1550 * 0.10);
  });

  it('foodTaxOverride does not affect alcohol items', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT, lineItems: [FOOD_ITEM, ALCOHOL_ITEM], foodTaxOverride: 0.10,
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    expect(s.alcoholTax).toBeCloseTo(1550 * 0.0725);
    expect(s.foodTax).toBeCloseTo(1550 * 0.10);
  });

  it('alcoholTaxOverride replaces default for alcohol items only', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT, lineItems: [FOOD_ITEM, ALCOHOL_ITEM], alcoholTaxOverride: 0.12,
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    expect(s.alcoholTax).toBeCloseTo(1550 * 0.12);
    expect(s.foodTax).toBeCloseTo(1550 * 0.0725);
  });

  it('generalTaxOverride replaces default for equipment tax', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT, lineItems: [EQUIPMENT_ITEM], generalTaxOverride: 0.06,
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    expect(s.equipmentTax).toBeCloseTo(1650 * 0.06);
  });

  it('generalTaxOverride does not affect food or alcohol tax', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT, lineItems: [FOOD_ITEM, ALCOHOL_ITEM], generalTaxOverride: 0.06,
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    expect(s.foodTax).toBeCloseTo(1550 * 0.0725);
    expect(s.alcoholTax).toBeCloseTo(1550 * 0.0725);
  });

  it('null override falls back to location default', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT, lineItems: [FOOD_ITEM],
      foodTaxOverride: null, alcoholTaxOverride: null, generalTaxOverride: null,
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    expect(s.foodTax).toBeCloseTo(1550 * 0.0725);
  });

  it('all three overrides work independently at the same time', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT,
      lineItems: [FOOD_ITEM, ALCOHOL_ITEM, EQUIPMENT_ITEM],
      foodTaxOverride: 0.10,
      alcoholTaxOverride: 0.12,
      generalTaxOverride: 0.06,
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    expect(s.foodTax).toBeCloseTo(1550 * 0.10);
    expect(s.alcoholTax).toBeCloseTo(1550 * 0.12);
    expect(s.equipmentTax).toBeCloseTo(1650 * 0.06);
  });

  it('override rate appears on individual line item (not default)', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT, lineItems: [FOOD_ITEM], foodTaxOverride: 0.085,
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    expect(s.foodTax).toBeCloseTo(1550 * 0.085);
    expect(s.foodTax).not.toBeCloseTo(1550 * 0.0725);
  });

  // Implied-rate tests: the ratio tax ÷ subtotal must equal the override rate,
  // not the location default. These guard the engine contract that the panel's
  // Show Math formula "subtotal × overrideRate = taxAmount" holds.

  it('implied food tax rate (foodTax / fbFoodSubtotalClient) equals override, not location default', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT,
      lineItems: [FOOD_ITEM],
      foodTaxOverride: 0.0825, // 8.25% — location default is 7.25%
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    const impliedRate = s.foodTax / s.fbFoodSubtotalClient;
    expect(impliedRate).toBeCloseTo(0.0825, 4); // must use override
    expect(impliedRate).not.toBeCloseTo(0.0725, 4); // must NOT use location default
  });

  it('implied alcohol tax rate (alcoholTax / fbAlcoholSubtotalClient) equals override', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT,
      lineItems: [ALCOHOL_ITEM],
      alcoholTaxOverride: 0.0775,
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    const impliedRate = s.alcoholTax / s.fbAlcoholSubtotalClient;
    expect(impliedRate).toBeCloseTo(0.0775, 4);
    expect(impliedRate).not.toBeCloseTo(0.0725, 4);
  });

  it('implied general tax rate (equipmentTax / equipmentSubtotalClient) equals override', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT,
      lineItems: [EQUIPMENT_ITEM],
      generalTaxOverride: 0.0825,
    };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    const impliedRate = s.equipmentTax / s.equipmentSubtotalClient;
    expect(impliedRate).toBeCloseTo(0.0825, 4);
    expect(impliedRate).not.toBeCloseTo(0.0725, 4);
  });

  it('without overrides, implied food tax rate equals location default', () => {
    const input: VenueEstimateInput = { ...BASE_INPUT, lineItems: [FOOD_ITEM] };
    const s = calculateVenueEstimate(input, NO_COMM_CONFIG);
    const impliedRate = s.foodTax / s.fbFoodSubtotalClient;
    expect(impliedRate).toBeCloseTo(0.0725, 4); // location default
  });
});

// ─── Travel in production fee ─────────────────────────────

describe('calculateVenueEstimate — travel in production fee', () => {
  const FOOD_ITEM: LineItem = {
    id: 'f1', section: 'F&B', taxBucket: 'fb', name: 'Food',
    qty: 1, unitPrice: 1000, categoryMarkupPct: 0.55, taxType: 'food',
  };
  // Config with real commission rates so productionFee > 0
  const COMM_CONFIG: ProgramConfig = {
    ...BASE_CONFIG,
    ccProcessingFee: 0.035,
    clientCommission: 0.05,
    gdpCommissionEnabled: false,
    serviceChargeDefault: 0, gratuityDefault: 0, adminFeeDefault: 0,
  };
  const BASE_INPUT: VenueEstimateInput = {
    name: 'Travel Test', fbMinimum: 0, isVenueTaxable: false,
    serviceCharge: 0, gratuity: 0, adminFee: 0, lineItems: [FOOD_ITEM],
  };

  it('travel excluded (default): travelInProductionFee = 0, production fee unchanged', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT, travelTotal: 500, includeTravelInProductionFee: false,
    };
    const base = calculateVenueEstimate(BASE_INPUT, COMM_CONFIG);
    const withTravel = calculateVenueEstimate(input, COMM_CONFIG);
    expect(withTravel.travelInProductionFee).toBe(0);
    expect(withTravel.productionFee).toBeCloseTo(base.productionFee);
    expect(withTravel.totalClient).toBeCloseTo(base.totalClient);
  });

  it('travel included: travelInProductionFee equals travelTotal', () => {
    const input: VenueEstimateInput = {
      ...BASE_INPUT, travelTotal: 500, includeTravelInProductionFee: true,
    };
    const s = calculateVenueEstimate(input, COMM_CONFIG);
    expect(s.travelInProductionFee).toBe(500);
  });

  it('travel included: production fee increases by travelTotal', () => {
    const base = calculateVenueEstimate(BASE_INPUT, COMM_CONFIG);
    const withTravel = calculateVenueEstimate(
      { ...BASE_INPUT, travelTotal: 500, includeTravelInProductionFee: true },
      COMM_CONFIG,
    );
    expect(withTravel.productionFee).toBeCloseTo(base.productionFee + 500);
  });

  it('travel included: totalClient increases by travelTotal', () => {
    const base = calculateVenueEstimate(BASE_INPUT, COMM_CONFIG);
    const withTravel = calculateVenueEstimate(
      { ...BASE_INPUT, travelTotal: 500, includeTravelInProductionFee: true },
      COMM_CONFIG,
    );
    // totalClient increases by travelTotal (plus any tax on travel if applicable)
    expect(withTravel.totalClient).toBeGreaterThan(base.totalClient + 499);
  });

  it('no travelTotal: travelInProductionFee = 0', () => {
    const s = calculateVenueEstimate(BASE_INPUT, COMM_CONFIG);
    expect(s.travelInProductionFee).toBe(0);
  });

  it('travelTotal = 0 with includeTravelInProductionFee = true: no change', () => {
    const base = calculateVenueEstimate(BASE_INPUT, COMM_CONFIG);
    const withZero = calculateVenueEstimate(
      { ...BASE_INPUT, travelTotal: 0, includeTravelInProductionFee: true },
      COMM_CONFIG,
    );
    expect(withZero.productionFee).toBeCloseTo(base.productionFee);
    expect(withZero.travelInProductionFee).toBe(0);
  });

  it('margin: when travel included, trueNetProfit higher than when excluded (client pays for it)', () => {
    const travelAmt = 1000;
    const included = calculateVenueEstimate(
      { ...BASE_INPUT, travelTotal: travelAmt, includeTravelInProductionFee: true },
      COMM_CONFIG,
    );
    const excluded = calculateVenueEstimate(
      { ...BASE_INPUT, travelTotal: travelAmt, includeTravelInProductionFee: false },
      COMM_CONFIG,
    );
    const marginIncluded = calculateMarginAnalysis(included, COMM_CONFIG, TEAM_HOURS_TIERS, travelAmt);
    const marginExcluded = calculateMarginAnalysis(excluded, COMM_CONFIG, TEAM_HOURS_TIERS, travelAmt);
    // When included: client pays travelAmt, QC recovers it → trueNetProfit = base (no travel impact).
    // When excluded: QC absorbs travelAmt from its own margin → trueNetProfit reduced by travelAmt.
    // Difference between the two ≈ travelAmt.
    expect(marginIncluded.trueNetProfit).toBeGreaterThan(marginExcluded.trueNetProfit);
    expect(marginIncluded.trueNetProfit - marginExcluded.trueNetProfit).toBeCloseTo(travelAmt, 0);
  });
});

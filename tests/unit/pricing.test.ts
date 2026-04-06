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
      { id: '1', section: 'F&B', name: 'Per Person Food', qty: 50, unitPrice: 50, categoryMarkupPct: 0.55, taxType: 'food' },
      { id: '2', section: 'F&B', name: 'Bar Package', qty: 50, unitPrice: 50, categoryMarkupPct: 0.55, taxType: 'alcohol' },
      { id: '3', section: 'F&B', name: 'NA Beverages', qty: 50, unitPrice: 8, categoryMarkupPct: 0.55, taxType: 'food' },
      // Equipment & Staffing
      { id: '4', section: 'Equipment & Staffing', name: 'Staffing', qty: 1, unitPrice: 200, categoryMarkupPct: 0.90, taxType: 'general' },
      { id: '5', section: 'Equipment & Staffing', name: 'Catering Equipment', qty: 1, unitPrice: 200, categoryMarkupPct: 0.65, taxType: 'general' },
      { id: '6', section: 'Equipment & Staffing', name: 'Rental Equipment', qty: 1, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'general' },
      { id: '7', section: 'Equipment & Staffing', name: 'Additional Equipment', qty: 1, unitPrice: 200, categoryMarkupPct: 0.65, taxType: 'general' },
      // Venue Fees
      { id: '8', section: 'Venue Fees', name: 'Venue / Room Rental', qty: 1, unitPrice: 200, categoryMarkupPct: 0.60, taxType: 'general' },
      { id: '9', section: 'Venue Fees', name: 'Additional Venue Space', qty: 1, unitPrice: 200, categoryMarkupPct: 0.60, taxType: 'general' },
      { id: '10', section: 'Venue Fees', name: 'Additional Services', qty: 1, unitPrice: 200, categoryMarkupPct: 0.60, taxType: 'general' },
      // Non-Taxable Staffing
      { id: '11', section: 'Non-Taxable Staffing', name: 'QC Event Staff', qty: 1, unitPrice: 500, categoryMarkupPct: 0.90, taxType: 'none' },
      { id: '12', section: 'Non-Taxable Staffing', name: 'Fee', qty: 1, unitPrice: 10, categoryMarkupPct: 0.90, taxType: 'none' },
      { id: '13', section: 'Non-Taxable Staffing', name: 'Fee', qty: 1, unitPrice: 10, categoryMarkupPct: 0.90, taxType: 'none' },
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
        { id: '1', section: 'Florals - Taxable', name: 'Centerpieces', qty: 10, unitPrice: 100, categoryMarkupPct: 0.85, taxType: 'general' },
        { id: '2', section: 'Rentals - Seating', name: 'Chairs', qty: 50, unitPrice: 10, categoryMarkupPct: 0.85, taxType: 'general' },
        { id: '3', section: 'Rentals - Lounge', name: 'Sofa', qty: 1, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'general' },
        { id: '4', section: 'Florals - Non-Taxable', name: 'Delivery', qty: 1, unitPrice: 300, categoryMarkupPct: 0.85, taxType: 'none' },
        { id: '5', section: 'Rentals - Non-Taxable', name: 'Rental Delivery', qty: 1, unitPrice: 150, categoryMarkupPct: 0.85, taxType: 'none' },
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
        { id: '1', section: 'Rentals - Tables', name: 'Farm Tables', qty: 5, unitPrice: 200, categoryMarkupPct: 0.85, taxType: 'general' },
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
    expect(result.totalClient).toBeCloseTo(subtotalClient + productionFee);
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

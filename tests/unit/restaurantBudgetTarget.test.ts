import { describe, it, expect } from 'vitest';
import { reverseCalculateBudgetTarget, type BudgetTargetInput, type BudgetTargetResult } from '../../src/lib/engine/restaurantBudgetTarget';
import { calculateVenueEstimate } from '../../src/lib/engine/pricing';
import type { VenueEstimateInput, ProgramConfig } from '../../src/types';

// ─── Shared config fixture ────────────────────────────────

function makeConfig(overrides: Partial<ProgramConfig> = {}): ProgramConfig {
  return {
    guestCount: 100,
    location: {
      id: 'loc-1',
      name: 'Charlotte, NC',
      foodTaxRate: 0.0775,
      alcoholTaxRate: 0.0775,
      generalTaxRate: 0.0775,
    },
    ccProcessingFee: 0.035,
    clientCommission: 0.05,
    gdpCommissionEnabled: false,
    gdpCommissionRate: 0.065,
    serviceChargeDefault: 0,
    gratuityDefault: 0,
    adminFeeDefault: 0,
    ...overrides,
  };
}

// Build a minimal VenueEstimateInput with a single all-food F&B line item at the given ourCostPP.
function makeForwardInput(
  ourCostPerPerson: number,
  guestCount: number,
  serviceCharge: number,
  gratuity: number,
  adminFee: number,
  taxExempt = false,
): VenueEstimateInput {
  return {
    name: 'Test',
    fbMinimum: 0,
    isVenueTaxable: false,
    serviceCharge,
    gratuity,
    adminFee,
    taxExempt,
    lineItems: [
      {
        id: 'li-1',
        section: 'Food & Beverage',
        taxBucket: 'fb',
        name: 'Test Food Item',
        qty: guestCount,
        unitPrice: ourCostPerPerson,
        categoryMarkupPct: 0.55,
        taxType: 'food',
      },
    ],
  };
}

// ─── Round-trip tests ─────────────────────────────────────

describe('reverseCalculateBudgetTarget — round-trip accuracy', () => {
  const SCENARIOS: Array<{
    label: string;
    ourCostPP: number;
    guestCount: number;
    serviceCharge: number;
    gratuity: number;
    adminFee: number;
    taxExempt?: boolean;
  }> = [
    { label: 'no fees, 100 guests',        ourCostPP: 50,  guestCount: 100, serviceCharge: 0,     gratuity: 0,   adminFee: 0 },
    { label: 'service charge only',         ourCostPP: 65,  guestCount: 80,  serviceCharge: 0.20,  gratuity: 0,   adminFee: 0 },
    { label: 'full fee stack',              ourCostPP: 80,  guestCount: 120, serviceCharge: 0.215, gratuity: 0.20, adminFee: 0.05 },
    { label: 'service + gratuity',          ourCostPP: 45,  guestCount: 50,  serviceCharge: 0.20,  gratuity: 0.20, adminFee: 0 },
    { label: 'large event, full fees',      ourCostPP: 120, guestCount: 250, serviceCharge: 0.215, gratuity: 0.20, adminFee: 0.05 },
    { label: 'tax exempt, no fees',         ourCostPP: 55,  guestCount: 60,  serviceCharge: 0,     gratuity: 0,   adminFee: 0, taxExempt: true },
    { label: 'tax exempt, full fees',       ourCostPP: 75,  guestCount: 90,  serviceCharge: 0.20,  gratuity: 0.20, adminFee: 0.05, taxExempt: true },
    { label: 'small event, all fees',       ourCostPP: 35,  guestCount: 20,  serviceCharge: 0.215, gratuity: 0.20, adminFee: 0.05 },
  ];

  for (const s of SCENARIOS) {
    it(`round-trips within $0.01/pp — ${s.label}`, () => {
      const config = makeConfig({ guestCount: s.guestCount });
      const forwardInput = makeForwardInput(s.ourCostPP, s.guestCount, s.serviceCharge, s.gratuity, s.adminFee, s.taxExempt);
      const forwardResult = calculateVenueEstimate(forwardInput, config);

      const targetClientPP = forwardResult.totalClient / s.guestCount;

      const backwardInput: BudgetTargetInput = {
        targetClientPP,
        fbMarkupPct: 0.55,
        foodTaxRate: 0.0775,
        generalTaxRate: 0.0775,
        serviceChargeRate: s.serviceCharge,
        gratuityRate: s.gratuity,
        adminFeeRate: s.adminFee,
        ccProcessingFee: 0.035,
        clientCommission: 0.05,
        taxExempt: s.taxExempt ?? false,
      };

      const result = reverseCalculateBudgetTarget(backwardInput);

      expect(result.vendorCostPerPerson).toBeCloseTo(s.ourCostPP, 1); // within $0.10
      expect(result.totalCheck).toBeCloseTo(targetClientPP, 1);
    });
  }
});

// ─── Structural / decomposition tests ────────────────────

describe('reverseCalculateBudgetTarget — decomposition', () => {
  it('totalCheck equals sum of all components', () => {
    const input: BudgetTargetInput = {
      targetClientPP: 100,
      fbMarkupPct: 0.55,
      foodTaxRate: 0.0775,
      generalTaxRate: 0.0775,
      serviceChargeRate: 0.20,
      gratuityRate: 0.20,
      adminFeeRate: 0.05,
      ccProcessingFee: 0.035,
      clientCommission: 0.05,
      taxExempt: false,
    };
    const r = reverseCalculateBudgetTarget(input);
    const sum = r.clientFBPerPerson + r.serviceChargePerPerson + r.gratuityPerPerson +
      r.adminFeePerPerson + r.fbTaxPerPerson + r.productionFeePerPerson + r.productionFeeTaxPerPerson;
    expect(sum).toBeCloseTo(r.totalCheck, 4);
    expect(r.totalCheck).toBeCloseTo(input.targetClientPP, 4);
  });

  it('no tax when taxExempt=true', () => {
    const input: BudgetTargetInput = {
      targetClientPP: 100,
      fbMarkupPct: 0.55,
      foodTaxRate: 0.0775,
      generalTaxRate: 0.0775,
      serviceChargeRate: 0,
      gratuityRate: 0,
      adminFeeRate: 0,
      ccProcessingFee: 0.035,
      clientCommission: 0.05,
      taxExempt: true,
    };
    const r = reverseCalculateBudgetTarget(input);
    expect(r.fbTaxPerPerson).toBe(0);
    expect(r.productionFeeTaxPerPerson).toBe(0);
  });

  it('no fees means service/gratuity/adminFee components are zero', () => {
    const input: BudgetTargetInput = {
      targetClientPP: 100,
      fbMarkupPct: 0.55,
      foodTaxRate: 0.0775,
      generalTaxRate: 0.0775,
      serviceChargeRate: 0,
      gratuityRate: 0,
      adminFeeRate: 0,
      ccProcessingFee: 0.035,
      clientCommission: 0.05,
      taxExempt: false,
    };
    const r = reverseCalculateBudgetTarget(input);
    expect(r.serviceChargePerPerson).toBe(0);
    expect(r.gratuityPerPerson).toBe(0);
    expect(r.adminFeePerPerson).toBe(0);
  });

  it('returns zero values when targetClientPP is 0', () => {
    const input: BudgetTargetInput = {
      targetClientPP: 0,
      fbMarkupPct: 0.55,
      foodTaxRate: 0.0775,
      generalTaxRate: 0.0775,
      serviceChargeRate: 0.20,
      gratuityRate: 0.20,
      adminFeeRate: 0.05,
      ccProcessingFee: 0.035,
      clientCommission: 0.05,
      taxExempt: false,
    };
    const r = reverseCalculateBudgetTarget(input);
    expect(r.vendorCostPerPerson).toBe(0);
    expect(r.clientFBPerPerson).toBe(0);
    expect(r.totalCheck).toBe(0);
  });

  it('vendorCostPerPerson = clientFBPerPerson / (1 + fbMarkupPct)', () => {
    const input: BudgetTargetInput = {
      targetClientPP: 150,
      fbMarkupPct: 0.55,
      foodTaxRate: 0.0775,
      generalTaxRate: 0.0775,
      serviceChargeRate: 0.215,
      gratuityRate: 0.20,
      adminFeeRate: 0.05,
      ccProcessingFee: 0.035,
      clientCommission: 0.05,
      taxExempt: false,
    };
    const r = reverseCalculateBudgetTarget(input);
    expect(r.vendorCostPerPerson).toBeCloseTo(r.clientFBPerPerson / (1 + 0.55), 6);
  });
});

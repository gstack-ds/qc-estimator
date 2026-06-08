import { describe, it, expect } from 'vitest';
import {
  reverseCalculateBudgetTarget,
  reverseCalculateBudgetTargetRange,
  type BudgetTargetInput,
  type BudgetTargetRangeInput,
} from '../../src/lib/engine/restaurantBudgetTarget';

// ─── Shared base input ────────────────────────────────────

const BASE: Omit<BudgetTargetInput, 'targetClientPP'> = {
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

const LOW  = 100;
const HIGH = 150;
const MID  = (LOW + HIGH) / 2;  // 125

// ─── Helpers ──────────────────────────────────────────────

function makeRange(overrides: Partial<BudgetTargetRangeInput> = {}): BudgetTargetRangeInput {
  return { ...BASE, targetClientPPLow: LOW, targetClientPPHigh: HIGH, ...overrides };
}

function singleResult(pp: number) {
  return reverseCalculateBudgetTarget({ ...BASE, targetClientPP: pp });
}

// ─── Core round-trip tests ────────────────────────────────

describe('reverseCalculateBudgetTargetRange — round-trips', () => {
  it('atLow.totalCheck ≈ targetClientPPLow', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange());
    expect(r.atLow.totalCheck).toBeCloseTo(LOW, 4);
  });

  it('atHigh.totalCheck ≈ targetClientPPHigh', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange());
    expect(r.atHigh.totalCheck).toBeCloseTo(HIGH, 4);
  });

  it('atPinned.totalCheck ≈ midpoint when no pinned given', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange());
    expect(r.atPinned.totalCheck).toBeCloseTo(MID, 4);
  });

  it('atPinned.totalCheck ≈ explicit pinnedClientPP when provided', () => {
    const pinned = 120;
    const r = reverseCalculateBudgetTargetRange(makeRange({ pinnedClientPP: pinned }));
    expect(r.atPinned.totalCheck).toBeCloseTo(pinned, 4);
  });

  it('pinnedClientPPUsed equals midpoint when pinnedClientPP is null', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange({ pinnedClientPP: null }));
    expect(r.pinnedClientPPUsed).toBeCloseTo(MID, 6);
  });

  it('pinnedClientPPUsed equals midpoint when pinnedClientPP is undefined', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange());
    expect(r.pinnedClientPPUsed).toBeCloseTo(MID, 6);
  });

  it('pinnedClientPPUsed equals explicit pinnedClientPP', () => {
    const pinned = 130;
    const r = reverseCalculateBudgetTargetRange(makeRange({ pinnedClientPP: pinned }));
    expect(r.pinnedClientPPUsed).toBe(pinned);
  });
});

// ─── Agreement with single-point function ────────────────

describe('reverseCalculateBudgetTargetRange — matches single-point results', () => {
  it('atLow matches reverseCalculateBudgetTarget(low)', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange());
    const s = singleResult(LOW);
    expect(r.atLow.vendorCostPerPerson).toBeCloseTo(s.vendorCostPerPerson, 6);
    expect(r.atLow.clientFBPerPerson).toBeCloseTo(s.clientFBPerPerson, 6);
    expect(r.atLow.productionFeePerPerson).toBeCloseTo(s.productionFeePerPerson, 6);
  });

  it('atHigh matches reverseCalculateBudgetTarget(high)', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange());
    const s = singleResult(HIGH);
    expect(r.atHigh.vendorCostPerPerson).toBeCloseTo(s.vendorCostPerPerson, 6);
    expect(r.atHigh.clientFBPerPerson).toBeCloseTo(s.clientFBPerPerson, 6);
  });

  it('atPinned matches reverseCalculateBudgetTarget(pinned)', () => {
    const pinned = 135;
    const r = reverseCalculateBudgetTargetRange(makeRange({ pinnedClientPP: pinned }));
    const s = singleResult(pinned);
    expect(r.atPinned.vendorCostPerPerson).toBeCloseTo(s.vendorCostPerPerson, 6);
  });
});

// ─── Monotonicity and edge cases ─────────────────────────

describe('reverseCalculateBudgetTargetRange — edge cases', () => {
  it('vendorCostPerPerson increases from atLow to atHigh', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange());
    expect(r.atLow.vendorCostPerPerson).toBeLessThan(r.atHigh.vendorCostPerPerson);
  });

  it('low === high → atLow, atHigh, atPinned all equal', () => {
    const pp = 125;
    const r = reverseCalculateBudgetTargetRange(makeRange({ targetClientPPLow: pp, targetClientPPHigh: pp }));
    expect(r.atLow.vendorCostPerPerson).toBeCloseTo(r.atHigh.vendorCostPerPerson, 6);
    expect(r.atLow.vendorCostPerPerson).toBeCloseTo(r.atPinned.vendorCostPerPerson, 6);
    expect(r.pinnedClientPPUsed).toBe(pp);
  });

  it('pinnedClientPP outside [low, high] is accepted without clamping', () => {
    // The function is a scratchpad — no artificial constraints on pin placement
    const pinned = 200;
    const r = reverseCalculateBudgetTargetRange(makeRange({ pinnedClientPP: pinned }));
    expect(r.atPinned.totalCheck).toBeCloseTo(pinned, 4);
    expect(r.pinnedClientPPUsed).toBe(pinned);
  });

  it('taxExempt range: all tax components zero across all three results', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange({ taxExempt: true }));
    expect(r.atLow.fbTaxPerPerson).toBe(0);
    expect(r.atHigh.fbTaxPerPerson).toBe(0);
    expect(r.atPinned.fbTaxPerPerson).toBe(0);
    expect(r.atLow.productionFeeTaxPerPerson).toBe(0);
    expect(r.atHigh.productionFeeTaxPerPerson).toBe(0);
    expect(r.atPinned.productionFeeTaxPerPerson).toBe(0);
  });

  it('zero targetClientPPLow → atLow all zeros', () => {
    const r = reverseCalculateBudgetTargetRange(makeRange({ targetClientPPLow: 0 }));
    expect(r.atLow.vendorCostPerPerson).toBe(0);
    expect(r.atLow.totalCheck).toBe(0);
  });
});

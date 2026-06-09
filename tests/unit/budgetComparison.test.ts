import { describe, it, expect } from 'vitest';
import {
  statusForValue,
  effectiveBudgetFlat,
  compareEstimateToBudget,
  combineEstimatesToBudget,
  type BudgetTarget,
} from '../../src/lib/engine/budgetComparison';

// ─── statusForValue ───────────────────────────────────────────────────────────

describe('statusForValue', () => {
  it('returns under when value < low', () => {
    expect(statusForValue(50, 100, 200)).toBe('under');
  });

  it('returns within_range when value === low', () => {
    expect(statusForValue(100, 100, 200)).toBe('within_range');
  });

  it('returns within_range when value is between low and high', () => {
    expect(statusForValue(150, 100, 200)).toBe('within_range');
  });

  it('returns within_range when value === high', () => {
    expect(statusForValue(200, 100, 200)).toBe('within_range');
  });

  it('returns over when value > high', () => {
    expect(statusForValue(201, 100, 200)).toBe('over');
  });

  it('treats single-value budget (low === high) correctly: exact match = within_range', () => {
    expect(statusForValue(100, 100, 100)).toBe('within_range');
  });

  it('treats single-value budget: below = under', () => {
    expect(statusForValue(99, 100, 100)).toBe('under');
  });

  it('treats single-value budget: above = over', () => {
    expect(statusForValue(101, 100, 100)).toBe('over');
  });

  it('returns under when budget is 0 (no budget set) — does not divide by zero', () => {
    expect(statusForValue(0, 0, 0)).toBe('within_range');
  });

  it('returns over when actual > 0 and budget is 0', () => {
    expect(statusForValue(100, 0, 0)).toBe('over');
  });
});

// ─── effectiveBudgetFlat ──────────────────────────────────────────────────────

describe('effectiveBudgetFlat', () => {
  it('returns flat values unchanged for flat basis', () => {
    const target: BudgetTarget = { pricingBasis: 'flat', valueLow: 10000, valueHigh: 20000, pinnedValue: null, guestCount: 50 };
    const result = effectiveBudgetFlat(target);
    expect(result.low).toBe(10000);
    expect(result.high).toBe(20000);
    expect(result.pinned).toBe(15000); // midpoint
  });

  it('uses pinned_value when set (flat basis)', () => {
    const target: BudgetTarget = { pricingBasis: 'flat', valueLow: 10000, valueHigh: 20000, pinnedValue: 18000, guestCount: 50 };
    const result = effectiveBudgetFlat(target);
    expect(result.pinned).toBe(18000);
  });

  it('scales per_person by guestCount', () => {
    const target: BudgetTarget = { pricingBasis: 'per_person', valueLow: 70, valueHigh: 100, pinnedValue: null, guestCount: 50 };
    const result = effectiveBudgetFlat(target);
    expect(result.low).toBe(3500);
    expect(result.high).toBe(5000);
    expect(result.pinned).toBe(4250); // midpoint(70,100) × 50
  });

  it('uses pinned_value for per_person midpoint when set', () => {
    const target: BudgetTarget = { pricingBasis: 'per_person', valueLow: 70, valueHigh: 100, pinnedValue: 90, guestCount: 50 };
    const result = effectiveBudgetFlat(target);
    expect(result.pinned).toBe(4500); // 90 × 50
  });

  it('handles zero guestCount without crashing (pp basis)', () => {
    const target: BudgetTarget = { pricingBasis: 'per_person', valueLow: 70, valueHigh: 100, pinnedValue: null, guestCount: 0 };
    const result = effectiveBudgetFlat(target);
    expect(result.low).toBe(0);
    expect(result.high).toBe(0);
    expect(result.pinned).toBe(0);
  });
});

// ─── compareEstimateToBudget ─────────────────────────────────────────────────

describe('compareEstimateToBudget', () => {
  const flatTarget: BudgetTarget = { pricingBasis: 'flat', valueLow: 10000, valueHigh: 20000, pinnedValue: null, guestCount: 50 };
  const ppTarget: BudgetTarget = { pricingBasis: 'per_person', valueLow: 70, valueHigh: 100, pinnedValue: null, guestCount: 50 };

  it('correctly computes delta for flat under-budget estimate', () => {
    const result = compareEstimateToBudget('est-1', 8000, 50, flatTarget);
    expect(result.status).toBe('under');
    expect(result.delta).toBe(8000 - 15000); // actual - pinned
    expect(result.budgetLow).toBe(10000);
    expect(result.budgetHigh).toBe(20000);
  });

  it('correctly computes delta for flat within-range estimate', () => {
    const result = compareEstimateToBudget('est-1', 12000, 50, flatTarget);
    expect(result.status).toBe('within_range');
    expect(result.delta).toBe(12000 - 15000);
  });

  it('correctly computes delta for flat over-budget estimate', () => {
    const result = compareEstimateToBudget('est-1', 22000, 50, flatTarget);
    expect(result.status).toBe('over');
    expect(result.delta).toBe(22000 - 15000);
  });

  it('compares per_person estimate against pp range × guestCount', () => {
    // $75/pp × 50 = $3,750; range is $3,500–$5,000
    const result = compareEstimateToBudget('est-1', 3750, 50, ppTarget);
    expect(result.status).toBe('within_range');
    expect(result.budgetLow).toBe(3500);
    expect(result.budgetHigh).toBe(5000);
  });

  it('marks pp estimate under range as under', () => {
    // $60/pp × 50 = $3,000; below $3,500 low
    const result = compareEstimateToBudget('est-1', 3000, 50, ppTarget);
    expect(result.status).toBe('under');
  });

  it('marks pp estimate over range as over', () => {
    // $110/pp × 50 = $5,500; above $5,000 high
    const result = compareEstimateToBudget('est-1', 5500, 50, ppTarget);
    expect(result.status).toBe('over');
  });

  it('returns pricePerPerson as ceil(total / guestCount)', () => {
    const result = compareEstimateToBudget('est-1', 3751, 50, ppTarget);
    expect(result.pricePerPerson).toBe(76); // ceil(3751/50)
  });

  it('returns pricePerPerson 0 when guestCount is 0', () => {
    const zeroGuest: BudgetTarget = { ...ppTarget, guestCount: 0 };
    const result = compareEstimateToBudget('est-1', 3000, 0, zeroGuest);
    expect(result.pricePerPerson).toBe(0);
  });
});

// ─── combineEstimatesToBudget ─────────────────────────────────────────────────

describe('combineEstimatesToBudget', () => {
  const flatTarget: BudgetTarget = { pricingBasis: 'flat', valueLow: 20000, valueHigh: 30000, pinnedValue: null, guestCount: 100 };

  it('sums totals of included estimates', () => {
    const cards = [
      { id: 'a', total: 5000, includeInBudget: true },
      { id: 'b', total: 8000, includeInBudget: true },
      { id: 'c', total: 3000, includeInBudget: false },
    ];
    const result = combineEstimatesToBudget(cards, flatTarget);
    expect(result.combinedTotal).toBe(13000); // excludes c
  });

  it('computes remaining correctly (under budget)', () => {
    const cards = [{ id: 'a', total: 10000, includeInBudget: true }];
    const result = combineEstimatesToBudget(cards, flatTarget);
    // pinned = midpoint(20000, 30000) = 25000; remaining = 25000 - 10000 = 15000
    expect(result.remaining).toBe(15000);
  });

  it('computes remaining correctly (over budget)', () => {
    const cards = [{ id: 'a', total: 35000, includeInBudget: true }];
    const result = combineEstimatesToBudget(cards, flatTarget);
    expect(result.remaining).toBe(-10000); // 25000 - 35000 = -10000
    expect(result.status).toBe('over');
  });

  it('status: under when combined < low', () => {
    const cards = [{ id: 'a', total: 5000, includeInBudget: true }];
    const result = combineEstimatesToBudget(cards, flatTarget);
    expect(result.status).toBe('under');
  });

  it('status: within_range when combined is between low and high', () => {
    const cards = [{ id: 'a', total: 25000, includeInBudget: true }];
    const result = combineEstimatesToBudget(cards, flatTarget);
    expect(result.status).toBe('within_range');
  });

  it('status: over when combined > high', () => {
    const cards = [{ id: 'a', total: 31000, includeInBudget: true }];
    const result = combineEstimatesToBudget(cards, flatTarget);
    expect(result.status).toBe('over');
  });

  it('pctConsumed is clamped between 0 and 1', () => {
    const cards = [{ id: 'a', total: 50000, includeInBudget: true }];
    const result = combineEstimatesToBudget(cards, flatTarget);
    expect(result.pctConsumed).toBe(1); // clamped at 1
  });

  it('pctConsumed is 0 when combined total is 0', () => {
    const result = combineEstimatesToBudget([], flatTarget);
    expect(result.pctConsumed).toBe(0);
  });

  it('handles zero budget gracefully', () => {
    const zeroTarget: BudgetTarget = { pricingBasis: 'flat', valueLow: 0, valueHigh: 0, pinnedValue: null, guestCount: 100 };
    const cards = [{ id: 'a', total: 5000, includeInBudget: true }];
    const result = combineEstimatesToBudget(cards, zeroTarget);
    expect(result.pctConsumed).toBe(1); // clamped
    expect(result.status).toBe('over');
  });

  it('uses pp basis: compares combined total against budget × guestCount', () => {
    const ppTarget: BudgetTarget = { pricingBasis: 'per_person', valueLow: 70, valueHigh: 100, pinnedValue: null, guestCount: 50 };
    const cards = [
      { id: 'a', total: 2000, includeInBudget: true },
      { id: 'b', total: 1000, includeInBudget: true },
    ];
    // combined = 3000; budget low = 70×50=3500, high = 100×50=5000
    const result = combineEstimatesToBudget(cards, ppTarget);
    expect(result.combinedTotal).toBe(3000);
    expect(result.budgetLow).toBe(3500);
    expect(result.budgetHigh).toBe(5000);
    expect(result.status).toBe('under');
  });

  it('returns within_range when combined equals low exactly (pp)', () => {
    const ppTarget: BudgetTarget = { pricingBasis: 'per_person', valueLow: 70, valueHigh: 100, pinnedValue: null, guestCount: 50 };
    const cards = [{ id: 'a', total: 3500, includeInBudget: true }];
    const result = combineEstimatesToBudget(cards, ppTarget);
    expect(result.status).toBe('within_range');
  });

  it('excludes zero-total estimates from pctConsumed calculation', () => {
    const cards = [
      { id: 'a', total: 0, includeInBudget: true },
      { id: 'b', total: 10000, includeInBudget: true },
    ];
    const result = combineEstimatesToBudget(cards, flatTarget);
    expect(result.combinedTotal).toBe(10000);
  });

  it('empty cards list gives 0 combined and under status', () => {
    const result = combineEstimatesToBudget([], flatTarget);
    expect(result.combinedTotal).toBe(0);
    expect(result.status).toBe('under');
    expect(result.remaining).toBe(25000); // pinned midpoint
  });
});

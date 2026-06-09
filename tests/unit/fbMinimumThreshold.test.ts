import { describe, it, expect } from 'vitest';
import { calculateFbBreakEven } from '../../src/lib/engine/fbMinimumThreshold';

describe('calculateFbBreakEven', () => {
  // ── no_minimum ────────────────────────────────────────────────────────────

  it('returns no_minimum when fbMinimum is 0', () => {
    const r = calculateFbBreakEven(0, 100, [{ qty: 100, unitPrice: 50 }]);
    expect(r.breakEvenGuestCount).toBeNull();
    expect(r.reason).toBe('no_minimum');
    expect(r.currentlyMet).toBe(true);
  });

  it('returns no_minimum when fbMinimum is negative', () => {
    const r = calculateFbBreakEven(-1, 50, []);
    expect(r.reason).toBe('no_minimum');
    expect(r.currentlyMet).toBe(true);
  });

  // ── already_met ───────────────────────────────────────────────────────────

  it('returns already_met when flat cost alone exceeds minimum', () => {
    const r = calculateFbBreakEven(1000, 50, [
      { qty: 1, unitPrice: 1500 },  // flat (qty 1 ≠ guestCount 50)
      { qty: 50, unitPrice: 10 },   // pp
    ]);
    expect(r.breakEvenGuestCount).toBeNull();
    expect(r.reason).toBe('already_met');
    expect(r.currentlyMet).toBe(true);
  });

  it('returns already_met when flat cost exactly equals minimum', () => {
    const r = calculateFbBreakEven(1000, 20, [{ qty: 1, unitPrice: 1000 }]);
    expect(r.reason).toBe('already_met');
    expect(r.currentlyMet).toBe(true);
  });

  // ── no_pp_items ───────────────────────────────────────────────────────────

  it('returns no_pp_items when no items exist', () => {
    const r = calculateFbBreakEven(2000, 50, []);
    expect(r.breakEvenGuestCount).toBeNull();
    expect(r.reason).toBe('no_pp_items');
    expect(r.currentlyMet).toBe(false);
  });

  it('returns no_pp_items when only flat items exist and they fall short', () => {
    const r = calculateFbBreakEven(5000, 100, [{ qty: 1, unitPrice: 2000 }]);
    expect(r.reason).toBe('no_pp_items');
    expect(r.currentlyMet).toBe(false);
  });

  it('returns no_pp_items when per-person items all have $0 price', () => {
    const r = calculateFbBreakEven(5000, 50, [{ qty: 50, unitPrice: 0 }]);
    expect(r.reason).toBe('no_pp_items');
    expect(r.currentlyMet).toBe(false);
  });

  // ── normal break-even ─────────────────────────────────────────────────────

  it('calculates break-even with only pp items', () => {
    // fbMin=5000, ppPerGuest=50 → N=100
    const r = calculateFbBreakEven(5000, 80, [{ qty: 80, unitPrice: 50 }]);
    expect(r.breakEvenGuestCount).toBe(100);
    expect(r.currentlyMet).toBe(false); // 80×50=4000 < 5000
  });

  it('calculates break-even with mixed flat + pp items', () => {
    // fbMin=5000, flat=1000, ppPerGuest=40 → N=ceil(4000/40)=100
    const r = calculateFbBreakEven(5000, 90, [
      { qty: 1, unitPrice: 1000 },
      { qty: 90, unitPrice: 40 },
    ]);
    expect(r.breakEvenGuestCount).toBe(100);
    expect(r.currentlyMet).toBe(false); // 1000+90×40=4600 < 5000
  });

  it('sums multiple pp items', () => {
    // fbMin=3000, ppPerGuest=10+20=30 → N=100
    const r = calculateFbBreakEven(3000, 80, [
      { qty: 80, unitPrice: 10 },
      { qty: 80, unitPrice: 20 },
    ]);
    expect(r.breakEvenGuestCount).toBe(100);
    expect(r.currentlyMet).toBe(false);
  });

  it('rounds fractional break-even up', () => {
    // fbMin=1000, ppPerGuest=30 → N=ceil(33.33)=34
    const r = calculateFbBreakEven(1000, 30, [{ qty: 30, unitPrice: 30 }]);
    expect(r.breakEvenGuestCount).toBe(34);
  });

  // ── currentlyMet boundary ─────────────────────────────────────────────────

  it('currentlyMet=true when guestCount equals break-even exactly', () => {
    // breakEven=100, guestCount=100 → met
    const r = calculateFbBreakEven(5000, 100, [{ qty: 100, unitPrice: 50 }]);
    expect(r.breakEvenGuestCount).toBe(100);
    expect(r.currentlyMet).toBe(true); // 100×50=5000 ≥ 5000
  });

  it('currentlyMet=false when guestCount is one below break-even', () => {
    const r = calculateFbBreakEven(5000, 99, [{ qty: 99, unitPrice: 50 }]);
    expect(r.breakEvenGuestCount).toBe(100);
    expect(r.currentlyMet).toBe(false); // 99×50=4950 < 5000
  });

  // ── revenue items excluded ────────────────────────────────────────────────

  it('excludes revenue items from the calculation', () => {
    // Without the revenue item: breakEven = ceil(1000/50) = 20
    const r = calculateFbBreakEven(1000, 15, [
      { qty: 15, unitPrice: 50 },
      { qty: 15, unitPrice: 100, isRevenueItem: true }, // excluded
    ]);
    expect(r.breakEvenGuestCount).toBe(20);
    expect(r.currentlyMet).toBe(false); // 15×50=750 < 1000
  });
});

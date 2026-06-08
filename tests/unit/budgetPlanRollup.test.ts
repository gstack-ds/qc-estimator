import { describe, it, expect } from 'vitest';
import { effectivePinned, calculateBudgetRollup } from '../../src/lib/engine/budgetPlan';
import type { DbBudgetPlanEntry } from '../../src/lib/supabase/queries';
import type { BudgetRollupRow, BudgetRollup } from '../../src/lib/engine/budgetPlan';

// ─── Fixtures ─────────────────────────────────────────────

function entry(overrides: Partial<DbBudgetPlanEntry> = {}): DbBudgetPlanEntry {
  return {
    id: 'e1',
    program_id: 'p1',
    entry_type: 'per_event',
    label: 'Test',
    linked_estimate_id: null,
    linked_event_id: null,
    pricing_basis: 'per_person',
    value_low: 100,
    value_high: 150,
    guest_low: null,
    guest_high: null,
    pinned_value: null,
    pool_total: null,
    sort_order: 0,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── effectivePinned tests ─────────────────────────────────

describe('effectivePinned', () => {
  it('returns pinned_value when set', () => {
    expect(effectivePinned(entry({ pinned_value: 120 }))).toBe(120);
  });

  it('returns midpoint when pinned_value is null', () => {
    expect(effectivePinned(entry({ value_low: 100, value_high: 150, pinned_value: null }))).toBe(125);
  });

  it('handles low === high', () => {
    expect(effectivePinned(entry({ value_low: 100, value_high: 100, pinned_value: null }))).toBe(100);
  });
});

// ─── calculateBudgetRollup — per_event per_person ─────────

describe('calculateBudgetRollup — per_event / per_person', () => {
  const GUEST = 80;

  it('targetLow = value_low × guest_count', () => {
    const e = entry({ id: 'a', value_low: 100, value_high: 200, pinned_value: null });
    const r = calculateBudgetRollup([e], {}, GUEST);
    expect(r.rows[0].targetLow).toBeCloseTo(100 * GUEST, 2);
  });

  it('targetHigh = value_high × guest_count', () => {
    const e = entry({ id: 'a', value_low: 100, value_high: 200, pinned_value: null });
    const r = calculateBudgetRollup([e], {}, GUEST);
    expect(r.rows[0].targetHigh).toBeCloseTo(200 * GUEST, 2);
  });

  it('pinnedTarget uses midpoint when pinned_value null', () => {
    const e = entry({ id: 'a', value_low: 100, value_high: 200, pinned_value: null });
    // midpoint = 150; pinnedTarget = 150 × 80 = 12000
    const r = calculateBudgetRollup([e], {}, GUEST);
    expect(r.rows[0].pinnedTarget).toBeCloseTo(150 * GUEST, 2);
  });

  it('pinnedTarget uses pinned_value when set', () => {
    const e = entry({ id: 'a', value_low: 100, value_high: 200, pinned_value: 120 });
    const r = calculateBudgetRollup([e], {}, GUEST);
    expect(r.rows[0].pinnedTarget).toBeCloseTo(120 * GUEST, 2);
  });

  it('uses guest_low/guest_high range when set', () => {
    const e = entry({ id: 'a', value_low: 100, value_high: 100, guest_low: 60, guest_high: 100, pinned_value: null });
    const r = calculateBudgetRollup([e], {}, GUEST);
    // low: 100 × 60 = 6000; high: 100 × 100 = 10000; pinned: 100 × 80 (midGuest) = 8000
    expect(r.rows[0].targetLow).toBeCloseTo(6000, 2);
    expect(r.rows[0].targetHigh).toBeCloseTo(10000, 2);
    expect(r.rows[0].pinnedTarget).toBeCloseTo(8000, 2);
  });

  it('uses programGuestCount as fallback when no guest range set', () => {
    const e = entry({ id: 'a', value_low: 50, value_high: 50, guest_low: null, guest_high: null, pinned_value: null });
    const r = calculateBudgetRollup([e], {}, 100);
    expect(r.rows[0].targetLow).toBeCloseTo(5000, 2);
  });
});

// ─── calculateBudgetRollup — per_event flat ────────────────

describe('calculateBudgetRollup — per_event / flat', () => {
  it('targetLow = value_low (no guest multiply)', () => {
    const e = entry({ id: 'a', pricing_basis: 'flat', value_low: 5000, value_high: 8000, pinned_value: null });
    const r = calculateBudgetRollup([e], {}, 80);
    expect(r.rows[0].targetLow).toBeCloseTo(5000, 2);
    expect(r.rows[0].targetHigh).toBeCloseTo(8000, 2);
  });

  it('pinnedTarget is midpoint of value range for flat', () => {
    const e = entry({ id: 'a', pricing_basis: 'flat', value_low: 5000, value_high: 9000, pinned_value: null });
    const r = calculateBudgetRollup([e], {}, 80);
    expect(r.rows[0].pinnedTarget).toBeCloseTo(7000, 2);
  });

  it('flat with explicit pinned_value', () => {
    const e = entry({ id: 'a', pricing_basis: 'flat', value_low: 5000, value_high: 9000, pinned_value: 6000 });
    const r = calculateBudgetRollup([e], {}, 80);
    expect(r.rows[0].pinnedTarget).toBeCloseTo(6000, 2);
  });
});

// ─── calculateBudgetRollup — pooled ───────────────────────

describe('calculateBudgetRollup — pooled', () => {
  it('targetLow = targetHigh = pinnedTarget = pool_total', () => {
    const e = entry({ id: 'a', entry_type: 'pooled', pool_total: 25000, value_low: 0, value_high: 0 });
    const r = calculateBudgetRollup([e], {}, 80);
    expect(r.rows[0].targetLow).toBeCloseTo(25000, 2);
    expect(r.rows[0].targetHigh).toBeCloseTo(25000, 2);
    expect(r.rows[0].pinnedTarget).toBeCloseTo(25000, 2);
  });

  it('pctFilled is actualTotal / pool_total when actual present', () => {
    const e = entry({ id: 'a', entry_type: 'pooled', pool_total: 20000, value_low: 0, value_high: 0, linked_estimate_id: 'est1' });
    const r = calculateBudgetRollup([e], { est1: 15000 }, 80);
    expect(r.rows[0].pctFilled).toBeCloseTo(15000 / 20000, 4);
  });

  it('pctFilled is null when no actual and no linked estimate', () => {
    const e = entry({ id: 'a', entry_type: 'pooled', pool_total: 20000, value_low: 0, value_high: 0 });
    const r = calculateBudgetRollup([e], {}, 80);
    expect(r.rows[0].pctFilled).toBeNull();
  });
});

// ─── calculateBudgetRollup — actuals and variance ─────────

describe('calculateBudgetRollup — actuals and variance', () => {
  it('actualTotal is estimateTotals[linked_estimate_id] when linked', () => {
    const e = entry({ id: 'a', linked_estimate_id: 'est1', value_low: 100, value_high: 150, pinned_value: null });
    const r = calculateBudgetRollup([e], { est1: 9500 }, 80);
    expect(r.rows[0].actualTotal).toBe(9500);
  });

  it('actualTotal is null when no linked estimate', () => {
    const e = entry({ id: 'a', linked_estimate_id: null, value_low: 100, value_high: 150, pinned_value: null });
    const r = calculateBudgetRollup([e], {}, 80);
    expect(r.rows[0].actualTotal).toBeNull();
  });

  it('variance = actualTotal - pinnedTarget when actual present', () => {
    const e = entry({ id: 'a', linked_estimate_id: 'est1', value_low: 100, value_high: 100, pinned_value: null });
    // pinned = 100/pp × 80 guests = 8000; actual = 9500; variance = +1500
    const r = calculateBudgetRollup([e], { est1: 9500 }, 80);
    expect(r.rows[0].variance).toBeCloseTo(1500, 2);
  });

  it('variance is null when no actual', () => {
    const e = entry({ id: 'a', linked_estimate_id: null, value_low: 100, value_high: 100, pinned_value: null });
    const r = calculateBudgetRollup([e], {}, 80);
    expect(r.rows[0].variance).toBeNull();
  });
});

// ─── calculateBudgetRollup — mixed entries and totals ─────

describe('calculateBudgetRollup — mixed entries and rollup totals', () => {
  it('rollup sums pinnedTarget across entries', () => {
    const entries = [
      entry({ id: 'a', value_low: 100, value_high: 100, pinned_value: null }),   // 100 × 80 = 8000
      entry({ id: 'b', entry_type: 'pooled', pool_total: 5000, value_low: 0, value_high: 0 }),  // 5000
      entry({ id: 'c', pricing_basis: 'flat', value_low: 3000, value_high: 3000, pinned_value: null }), // 3000
    ];
    const r = calculateBudgetRollup(entries, {}, 80);
    expect(r.totalPinnedTarget).toBeCloseTo(8000 + 5000 + 3000, 2);
  });

  it('rollup sums targetLow and targetHigh across entries', () => {
    const entries = [
      entry({ id: 'a', value_low: 100, value_high: 200 }),  // 8000 / 16000
      entry({ id: 'b', entry_type: 'pooled', pool_total: 5000, value_low: 0, value_high: 0 }),  // 5000 / 5000
    ];
    const r = calculateBudgetRollup(entries, {}, 80);
    expect(r.totalLow).toBeCloseTo(8000 + 5000, 2);
    expect(r.totalHigh).toBeCloseTo(16000 + 5000, 2);
  });

  it('rollup totalActual sums only entries with actuals', () => {
    const entries = [
      entry({ id: 'a', linked_estimate_id: 'est1', value_low: 100, value_high: 100, pinned_value: null }),
      entry({ id: 'b', linked_estimate_id: null, value_low: 100, value_high: 100, pinned_value: null }),
    ];
    const r = calculateBudgetRollup(entries, { est1: 9000 }, 80);
    expect(r.totalActual).toBe(9000);
  });

  it('rollup totalActual is null when no entries have actuals', () => {
    const entries = [
      entry({ id: 'a', linked_estimate_id: null, value_low: 100, value_high: 100, pinned_value: null }),
    ];
    const r = calculateBudgetRollup(entries, {}, 80);
    expect(r.totalActual).toBeNull();
  });

  it('empty entries list returns zero totals', () => {
    const r = calculateBudgetRollup([], {}, 80);
    expect(r.rows).toHaveLength(0);
    expect(r.totalPinnedTarget).toBe(0);
    expect(r.totalLow).toBe(0);
    expect(r.totalHigh).toBe(0);
    expect(r.totalActual).toBeNull();
  });
});

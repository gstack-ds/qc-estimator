import { describe, it, expect } from 'vitest';
import { effectivePrefillPP } from '../../src/lib/engine/budgetPlan';
import type { DbBudgetPlanEntry } from '../../src/lib/supabase/queries';

// ─── Minimal entry fixture ────────────────────────────────

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

// ─── effectivePrefillPP tests ─────────────────────────────

describe('effectivePrefillPP', () => {
  it('returns pinned_value when set', () => {
    expect(effectivePrefillPP(entry({ pinned_value: 120 }))).toBe(120);
  });

  it('returns midpoint when pinned_value is null', () => {
    // (100 + 150) / 2 = 125
    expect(effectivePrefillPP(entry({ pinned_value: null }))).toBe(125);
  });

  it('returns midpoint when low === high', () => {
    expect(effectivePrefillPP(entry({ value_low: 100, value_high: 100, pinned_value: null }))).toBe(100);
  });

  it('returns low when pinned_value is 0 (explicit zero pin)', () => {
    // 0 is a valid pin — pinned_value ?? … does not treat 0 as nullish
    expect(effectivePrefillPP(entry({ value_low: 80, value_high: 160, pinned_value: 0 }))).toBe(0);
  });

  it('returns exact pinned_value when pinned is not the midpoint', () => {
    expect(effectivePrefillPP(entry({ value_low: 100, value_high: 200, pinned_value: 175 }))).toBe(175);
  });

  it('works when entry is pooled (value_low/high still present on type)', () => {
    // Pooled entries don't have meaningful PP — caller decides whether to use this,
    // but the helper should not throw.
    expect(() =>
      effectivePrefillPP(entry({ entry_type: 'pooled', value_low: 0, value_high: 0, pinned_value: null }))
    ).not.toThrow();
  });

  it('midpoint is computed with both low and high, not just low', () => {
    expect(effectivePrefillPP(entry({ value_low: 50, value_high: 90, pinned_value: null }))).toBe(70);
  });
});

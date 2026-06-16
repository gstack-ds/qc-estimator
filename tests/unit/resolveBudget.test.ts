import { describe, it, expect } from 'vitest';
import { resolveEstimateBudget, type BudgetEntryLike, type ResolveBudgetInput } from '../../src/lib/budget/resolveBudget';

function perEvent(p: Partial<BudgetEntryLike>): BudgetEntryLike {
  return { entry_type: 'per_event', pricing_basis: 'per_person', value_low: 0, value_high: 0, pool_total: null, linked_event_id: null, ...p };
}
function pooled(total: number): BudgetEntryLike {
  return { entry_type: 'pooled', pricing_basis: 'flat', value_low: 0, value_high: 0, pool_total: total, linked_event_id: null };
}
function base(p: Partial<ResolveBudgetInput>): ResolveBudgetInput {
  return { estimateEntry: null, eventId: null, eventBudgetAmount: null, eventBudgetBasis: null, entries: [], ...p };
}

describe('resolveEstimateBudget — precedence', () => {
  it('1. estimate-linked entry wins over everything', () => {
    const r = resolveEstimateBudget(base({
      estimateEntry: perEvent({ pricing_basis: 'per_person', value_low: 150, value_high: 150 }),
      eventId: 'ev1',
      eventBudgetAmount: 9999, eventBudgetBasis: 'overall',
      entries: [perEvent({ linked_event_id: 'ev1', value_low: 100, value_high: 100 }), pooled(50000)],
    }));
    expect(r.source).toBe('estimate_entry');
    expect(r.label).toBe('$150/pp');
  });

  it('2. event-level budget wins when no estimate entry', () => {
    const r = resolveEstimateBudget(base({
      eventId: 'ev1',
      eventBudgetAmount: 5000, eventBudgetBasis: 'overall',
      entries: [perEvent({ linked_event_id: 'ev1', value_low: 100, value_high: 100 }), pooled(50000)],
    }));
    expect(r.source).toBe('event');
    expect(r.label).toBe('$5,000');
  });

  it('2. event-level per_person formats with /pp', () => {
    const r = resolveEstimateBudget(base({ eventBudgetAmount: 120, eventBudgetBasis: 'per_person' }));
    expect(r).toEqual({
      source: 'event',
      label: '$120/pp',
      target: { pricingBasis: 'per_person', valueLow: 120, valueHigh: 120, pinnedValue: 120 },
    });
  });

  it('3. event-linked entry when no estimate entry and no event budget', () => {
    const r = resolveEstimateBudget(base({
      eventId: 'ev1',
      entries: [perEvent({ linked_event_id: 'ev1', pricing_basis: 'flat', value_low: 4000, value_high: 6000 }), pooled(50000)],
    }));
    expect(r.source).toBe('event_entry');
    expect(r.label).toBe('$4,000–$6,000');
  });

  it('4. pooled when nothing more specific — single pool (informational, no compare target)', () => {
    const r = resolveEstimateBudget(base({ entries: [pooled(20000)] }));
    expect(r).toEqual({ source: 'pooled', label: 'part of $20,000 pool', target: null });
  });

  it('4. pooled — multiple pools sum and use "pooled" wording', () => {
    const r = resolveEstimateBudget(base({ entries: [pooled(20000), pooled(5000)] }));
    expect(r).toEqual({ source: 'pooled', label: 'part of $25,000 pooled', target: null });
  });

  it('none when there is no budget anywhere', () => {
    expect(resolveEstimateBudget(base({}))).toEqual({ source: 'none', label: null, target: null });
  });

  it('a pooled entry with no/zero total is treated as not-set (no "$0 pool")', () => {
    expect(resolveEstimateBudget(base({ entries: [pooled(0)] }))).toEqual({ source: 'none', label: null, target: null });
    const nullPool: BudgetEntryLike = { ...pooled(0), pool_total: null };
    expect(resolveEstimateBudget(base({ entries: [nullPool] })).source).toBe('none');
  });
});

describe('resolveEstimateBudget — comparable target (per-card badge agreement)', () => {
  it('estimate-linked entry yields a target so the badge compares against the SAME budget the header shows', () => {
    const r = resolveEstimateBudget(base({
      estimateEntry: perEvent({ pricing_basis: 'per_person', value_low: 90, value_high: 120, pinned_value: 100 }),
      eventBudgetAmount: 5000, eventBudgetBasis: 'overall', // would otherwise win for the badge — estimate entry overrides
    }));
    expect(r.source).toBe('estimate_entry');
    expect(r.target).toEqual({ pricingBasis: 'per_person', valueLow: 90, valueHigh: 120, pinnedValue: 100 });
  });

  it('event-linked entry yields a target with its pinned value', () => {
    const r = resolveEstimateBudget(base({
      eventId: 'ev1',
      entries: [perEvent({ linked_event_id: 'ev1', pricing_basis: 'flat', value_low: 4000, value_high: 6000, pinned_value: 5000 })],
    }));
    expect(r.source).toBe('event_entry');
    expect(r.target).toEqual({ pricingBasis: 'flat', valueLow: 4000, valueHigh: 6000, pinnedValue: 5000 });
  });

  it('pooled and none have no compare target (badge shows nothing; combine mode handles pools)', () => {
    expect(resolveEstimateBudget(base({ entries: [pooled(20000)] })).target).toBeNull();
    expect(resolveEstimateBudget(base({})).target).toBeNull();
  });

  it('event budget of 0 or null does not count as set', () => {
    expect(resolveEstimateBudget(base({ eventBudgetAmount: 0, eventBudgetBasis: 'overall' })).source).toBe('none');
    expect(resolveEstimateBudget(base({ eventBudgetAmount: null })).source).toBe('none');
  });

  it('event-linked entry is ignored when estimate has no event', () => {
    // entries contain an event-linked entry but this estimate is unassigned (eventId null)
    const r = resolveEstimateBudget(base({
      eventId: null,
      entries: [perEvent({ linked_event_id: 'ev1', value_low: 100, value_high: 100 })],
    }));
    expect(r.source).toBe('none');
  });

  it('single-value entry shows one figure; range shows both', () => {
    expect(resolveEstimateBudget(base({ estimateEntry: perEvent({ pricing_basis: 'per_person', value_low: 90, value_high: 90 }) })).label).toBe('$90/pp');
    expect(resolveEstimateBudget(base({ estimateEntry: perEvent({ pricing_basis: 'per_person', value_low: 90, value_high: 120 }) })).label).toBe('$90–$120/pp');
  });
});

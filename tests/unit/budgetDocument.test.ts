import { describe, it, expect } from 'vitest';
import {
  lineMode,
  modeToToggles,
  memberEffective,
  memberContribution,
  computeLineTotals,
  computeBudgetTotals,
  assignTiersByRank,
  type BudgetLine,
  type BudgetMember,
  type BudgetDocument,
} from '@/lib/budget/budgetDocument';

function member(p: Partial<BudgetMember> = {}): BudgetMember {
  return {
    id: p.id ?? 'm1',
    sourceEstimateId: p.sourceEstimateId ?? 'e1',
    tier: p.tier ?? null,
    label: p.label ?? null,
    derivedValue: p.derivedValue ?? 0,
    derivedPp: p.derivedPp ?? 0,
    overrideValue: p.overrideValue ?? null,
    sourceRemoved: p.sourceRemoved ?? false,
    rank: p.rank ?? 0,
    sortOrder: p.sortOrder ?? 0,
  };
}

function line(p: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: p.id ?? 'l1',
    eventId: p.eventId ?? null,
    name: p.name ?? 'Line',
    aggregation: p.aggregation ?? 'sum',
    tiered: p.tiered ?? false,
    isPerPerson: p.isPerPerson ?? false,
    guestCount: p.guestCount ?? null,
    isOptional: p.isOptional ?? false,
    isIncluded: p.isIncluded ?? true,
    selectedMemberId: p.selectedMemberId ?? null,
    notes: p.notes ?? null,
    sortOrder: p.sortOrder ?? 0,
    members: p.members ?? [],
  };
}

describe('mode mapping', () => {
  it('maps the two toggles to a single 3-way mode', () => {
    expect(lineMode({ aggregation: 'sum', tiered: false })).toBe('add_up');
    expect(lineMode({ aggregation: 'select_one', tiered: false })).toBe('pick_one');
    expect(lineMode({ aggregation: 'select_one', tiered: true })).toBe('tiers');
  });
  it('maps a mode back to the stored toggles', () => {
    expect(modeToToggles('add_up')).toEqual({ aggregation: 'sum', tiered: false });
    expect(modeToToggles('pick_one')).toEqual({ aggregation: 'select_one', tiered: false });
    expect(modeToToggles('tiers')).toEqual({ aggregation: 'select_one', tiered: true });
  });
});

describe('member value resolution', () => {
  it('uses derived total for flat, derived pp for per-person', () => {
    const m = member({ derivedValue: 5000, derivedPp: 100 });
    expect(memberEffective(m, false)).toBe(5000);
    expect(memberEffective(m, true)).toBe(100);
  });
  it('override beats derived (and zero override is honored)', () => {
    expect(memberEffective(member({ derivedValue: 5000, overrideValue: 4000 }), false)).toBe(4000);
    expect(memberEffective(member({ derivedValue: 5000, overrideValue: 0 }), false)).toBe(0);
  });
  it('per-person contribution multiplies rate by guest count; flat does not', () => {
    const m = member({ derivedValue: 5000, derivedPp: 100 });
    expect(memberContribution(m, true, 70)).toBe(7000);
    expect(memberContribution(m, false, 70)).toBe(5000);
  });
});

describe('computeLineTotals — Add up (sum)', () => {
  it('sums all members (single-member = single price)', () => {
    const l = line({ members: [member({ id: 'a', derivedValue: 1000 })] });
    expect(computeLineTotals(l, 100)).toEqual({ selected: 1000, low: 1000, high: 1000 });
  });
  it('sums multiple members (combined design)', () => {
    const l = line({
      members: [member({ id: 'a', derivedValue: 1000 }), member({ id: 'b', derivedValue: 2500 })],
    });
    expect(computeLineTotals(l, 100)).toEqual({ selected: 3500, low: 3500, high: 3500 });
  });
  it('per-person sum uses the line guest count', () => {
    const l = line({ isPerPerson: true, guestCount: 36, members: [member({ derivedPp: 350 })] });
    expect(computeLineTotals(l, 250)).toEqual({ selected: 12600, low: 12600, high: 12600 });
  });
});

describe('computeLineTotals — Pick one (select_one, flat)', () => {
  it('only the selected member counts; falls back to first when unset', () => {
    const members = [
      member({ id: 'a', derivedValue: 8000 }),
      member({ id: 'b', derivedValue: 12000 }),
    ];
    expect(computeLineTotals(line({ aggregation: 'select_one', members, selectedMemberId: 'b' }), 100))
      .toEqual({ selected: 12000, low: 12000, high: 12000 });
    expect(computeLineTotals(line({ aggregation: 'select_one', members, selectedMemberId: null }), 100).selected)
      .toBe(8000);
  });
});

describe('computeLineTotals — Low/Mid/High (tiered)', () => {
  it('selected is the chosen tier; low/high read the tier members', () => {
    const members = [
      member({ id: 'lo', tier: 'low', derivedValue: 11250 }),
      member({ id: 'md', tier: 'mid', derivedValue: 13300 }),
      member({ id: 'hi', tier: 'high', derivedValue: 18750 }),
    ];
    const l = line({ aggregation: 'select_one', tiered: true, members, selectedMemberId: 'md' });
    expect(computeLineTotals(l, 100)).toEqual({ selected: 13300, low: 11250, high: 18750 });
  });
});

describe('computeBudgetTotals', () => {
  it('rolls up Selected/Low/High, per-person, and per-event buckets; skips excluded lines', () => {
    const doc: BudgetDocument = {
      id: 'd', programId: 'p', title: null, status: 'draft', disclaimers: null,
      lines: [
        line({ id: 'l1', eventId: 'ev1', members: [member({ id: 'a', derivedValue: 10000 })] }),
        line({
          id: 'l2', eventId: 'ev1', aggregation: 'select_one', tiered: true, selectedMemberId: 'md',
          members: [
            member({ id: 'lo', tier: 'low', derivedValue: 2000 }),
            member({ id: 'md', tier: 'mid', derivedValue: 5000 }),
            member({ id: 'hi', tier: 'high', derivedValue: 9000 }),
          ],
        }),
        // excluded — must not count
        line({ id: 'l3', eventId: 'ev2', isIncluded: false, members: [member({ id: 'z', derivedValue: 99999 })] }),
      ],
    };
    const t = computeBudgetTotals(doc, 250, 250);
    expect(t.selected).toBe(15000); // 10000 + 5000
    expect(t.low).toBe(12000);      // 10000 + 2000
    expect(t.high).toBe(19000);     // 10000 + 9000
    expect(t.perPerson).toBe(60);   // 15000 / 250
    expect(t.byEvent['ev1']).toEqual({ selected: 15000, low: 12000, high: 19000 });
    expect(t.byEvent['ev2']).toBeUndefined();
  });

  it('per-line guest count overrides the fallback', () => {
    const doc: BudgetDocument = {
      id: 'd', programId: 'p', title: null, status: 'draft', disclaimers: null,
      lines: [line({ isPerPerson: true, guestCount: 36, members: [member({ derivedPp: 100 })] })],
    };
    expect(computeBudgetTotals(doc, 250, 250).selected).toBe(3600); // 100 * 36, not * 250
  });
});

describe('assignTiersByRank', () => {
  it('ranks cheapest→low, priciest→high, middle→mid', () => {
    const res = assignTiersByRank([
      member({ id: 'a', derivedValue: 18750 }),
      member({ id: 'b', derivedValue: 11250 }),
      member({ id: 'c', derivedValue: 13300 }),
    ]);
    expect(res).toEqual([
      { id: 'b', tier: 'low' },
      { id: 'c', tier: 'mid' },
      { id: 'a', tier: 'high' },
    ]);
  });
  it('ranks per-person lines by the pp rate, not the flat total', () => {
    // derivedValue (flat totals) would rank a<b<c, but the pp rates rank c<a<b.
    const res = assignTiersByRank([
      member({ id: 'a', derivedValue: 1000, derivedPp: 90 }),
      member({ id: 'b', derivedValue: 2000, derivedPp: 120 }),
      member({ id: 'c', derivedValue: 3000, derivedPp: 75 }),
    ], true);
    expect(res).toEqual([
      { id: 'c', tier: 'low' },
      { id: 'a', tier: 'mid' },
      { id: 'b', tier: 'high' },
    ]);
  });
  it('handles 1 and 2 members (low only; low/high)', () => {
    expect(assignTiersByRank([member({ id: 'a', derivedValue: 500 })])).toEqual([{ id: 'a', tier: 'low' }]);
    expect(assignTiersByRank([
      member({ id: 'a', derivedValue: 900 }),
      member({ id: 'b', derivedValue: 400 }),
    ])).toEqual([{ id: 'b', tier: 'low' }, { id: 'a', tier: 'high' }]);
  });
});

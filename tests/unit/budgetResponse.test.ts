import { describe, it, expect } from 'vitest';
import {
  RespondPayloadSchema,
  validateResponse,
  GUEST_MAX,
} from '@/lib/budget/budgetResponse';
import { buildBudgetShareContract } from '@/lib/budget/budgetShareContract';
import type { BudgetLine, BudgetMember } from '@/lib/budget/budgetDocument';

function member(p: Partial<BudgetMember> = {}): BudgetMember {
  return {
    id: p.id ?? 'm1', sourceEstimateId: null, tier: p.tier ?? null, label: p.label ?? null,
    derivedValue: p.derivedValue ?? 0, derivedPp: p.derivedPp ?? 0,
    overrideValue: p.overrideValue ?? null, sourceRemoved: false, rank: 0, sortOrder: p.sortOrder ?? 0,
  };
}
function line(p: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: p.id ?? 'l1', eventId: p.eventId ?? 'ev1', name: p.name ?? 'Line',
    aggregation: p.aggregation ?? 'sum', tiered: p.tiered ?? false, isPerPerson: p.isPerPerson ?? false,
    guestCount: p.guestCount ?? null, isOptional: false, isIncluded: p.isIncluded ?? true,
    selectedMemberId: p.selectedMemberId ?? null, notes: p.notes ?? null, sortOrder: 0, members: p.members ?? [],
  };
}

// A snapshot mirroring a real budget: a flat line, a tiered Band line (low/mid/high), and a
// per-person line. The tiered line's selected tier defaults to 'mid'.
function contract() {
  return buildBudgetShareContract({
    programName: 'Retail Elite 2027',
    guestCount: 100,
    events: [{ id: 'ev1', name: 'Awards Dinner' }],
    lines: [
      line({ id: 'flat', name: 'Linens', members: [member({ id: 'f1', derivedValue: 5000 })] }),
      line({
        id: 'band', name: 'Band', aggregation: 'select_one', tiered: true, selectedMemberId: 'mid',
        members: [
          member({ id: 'lo', tier: 'low', derivedValue: 11250 }),
          member({ id: 'mid', tier: 'mid', derivedValue: 13300 }),
          member({ id: 'hi', tier: 'high', derivedValue: 18750 }),
        ],
      }),
      line({ id: 'gift', name: 'Gift', isPerPerson: true, guestCount: 100, members: [member({ id: 'g1', derivedPp: 100 })] }),
    ],
    disclaimers: null,
  });
}

// ── GATE 1: the validator rejects anything not in the snapshot ────────────────

describe('GATE 1 — validateResponse rejects anything not in the snapshot', () => {
  it('drops a made-up tier (not among the line\'s tiers)', () => {
    const payload = RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'band', tier: 'mid' }] });
    // sanity: 'mid' is valid and kept
    expect(validateResponse(contract(), payload).lineSelections[0].tier).toBe('mid');

    // 'ultra' isn't even in the Zod enum → Zod rejects it at the shape layer.
    expect(() => RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'band', tier: 'ultra' }] })).toThrow();
  });

  it('drops a tier applied to a non-tiered line', () => {
    const payload = RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'flat', tier: 'low' }] });
    // 'flat' is a sum line — it has no tiers, so the tier is dropped and the row carries nothing → removed
    const res = validateResponse(contract(), payload);
    expect(res.lineSelections).toHaveLength(0);
  });

  it('rejects an out-of-bounds guest count at the shape layer', () => {
    expect(() => RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'gift', guestCount: 0 }] })).toThrow();
    expect(() => RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'gift', guestCount: -5 }] })).toThrow();
    expect(() => RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'gift', guestCount: GUEST_MAX + 1 }] })).toThrow();
    expect(() => RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'gift', guestCount: 12.5 }] })).toThrow();
  });

  it('drops a guest count applied to a non-per-person line', () => {
    // 'flat' (Linens) isn't per-person — a crafted guest count must not persist or affect pricing.
    const payload = RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'flat', guestCount: 500 }] });
    const res = validateResponse(contract(), payload);
    expect(res.lineSelections).toHaveLength(0);
    expect(res.computedTotal).toBe(28_300); // unchanged default total
  });

  it('drops a selection for a non-existent line ID', () => {
    const payload = RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'does-not-exist', tier: 'low' }] });
    expect(validateResponse(contract(), payload).lineSelections).toHaveLength(0);
  });

  it('strips arbitrary/price fields — they never survive parsing', () => {
    const parsed = RespondPayloadSchema.parse({
      lineSelections: [{ lineId: 'band', tier: 'low', price: 1, unitPrice: 999, total: 0 }],
      computedTotal: 1, grandTotal: 1, evil: true,
    } as Record<string, unknown>);
    // unknown top-level + per-line keys are gone
    expect(parsed).not.toHaveProperty('computedTotal');
    expect(parsed).not.toHaveProperty('grandTotal');
    expect(parsed).not.toHaveProperty('evil');
    expect(parsed.lineSelections[0]).not.toHaveProperty('price');
    expect(parsed.lineSelections[0]).not.toHaveProperty('unitPrice');
    expect(parsed.lineSelections[0]).not.toHaveProperty('total');
    expect(Object.keys(parsed.lineSelections[0]).sort()).toEqual(['lineId', 'tier']);
  });

  it('drops a category target keyed to a non-existent event; keeps a real one', () => {
    const payload = RespondPayloadSchema.parse({
      categoryTargets: [{ eventId: 'ev1', amount: 10000 }, { eventId: 'fake', amount: 99999 }],
    });
    const res = validateResponse(contract(), payload);
    expect(res.categoryTargets).toEqual([{ eventId: 'ev1', amount: 10000 }]);
  });

});

describe('notes length is enforced at the shape layer', () => {
  it('rejects notes beyond the cap', () => {
    expect(() => RespondPayloadSchema.parse({ notes: 'x'.repeat(5000) })).toThrow();
  });
  it('accepts notes within the cap and preserves them', () => {
    const payload = RespondPayloadSchema.parse({ notes: 'Can we add a vegan option?' });
    expect(validateResponse(contract(), payload).notes).toBe('Can we add a vegan option?');
  });
});

// ── GATE 2: total is computed server-side and ignores any client-sent total ───

describe('GATE 2 — total is computed server-side, never from the client', () => {
  it('ignores a client-sent total and computes from the locked snapshot', () => {
    // Client tries to send a bogus total of $1 alongside default selections.
    const payload = RespondPayloadSchema.parse({ lineSelections: [], computedTotal: 1, total: 1 } as Record<string, unknown>);
    const res = validateResponse(contract(), payload);
    // 5000 (flat) + 13300 (mid, default) + 100*100 (gift) = 28,300 — NOT 1
    expect(res.computedTotal).toBe(28_300);
  });

  it('recomputes when the client picks a different tier (low)', () => {
    const payload = RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'band', tier: 'low' }] });
    const res = validateResponse(contract(), payload);
    // 5000 + 11250 (low) + 10000 = 26,250
    expect(res.computedTotal).toBe(26_250);
  });

  it('recomputes when the client changes a per-person guest count', () => {
    const payload = RespondPayloadSchema.parse({ lineSelections: [{ lineId: 'gift', guestCount: 150 }] });
    const res = validateResponse(contract(), payload);
    // gift now 100*150 = 15000; 5000 + 13300 + 15000 = 33,300
    expect(res.computedTotal).toBe(33_300);
    expect(res.lineSelections[0]).toEqual({ lineId: 'gift', guestCount: 150 });
  });

  it('produces a per-event breakdown', () => {
    const res = validateResponse(contract(), RespondPayloadSchema.parse({}));
    expect(res.computedByEvent['ev1']).toBe(28_300);
  });

  it('the price comes only from the snapshot — a client "tier price" cannot change it', () => {
    // Even if a client crafts a per-line price, it's stripped; tier 'high' uses the SNAPSHOT's 18750.
    const payload = RespondPayloadSchema.parse({
      lineSelections: [{ lineId: 'band', tier: 'high', derivedValue: 1, overrideValue: 1 }],
    } as Record<string, unknown>);
    const res = validateResponse(contract(), payload);
    // 5000 + 18750 (snapshot high) + 10000 = 33,750 — uses locked price, not the client's "1"
    expect(res.computedTotal).toBe(33_750);
  });
});

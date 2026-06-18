// Budget builder — pure types + total computation.
// Framework-agnostic: no React, no Supabase, no Next. Fully unit-testable.
//
// A budget is a set of lines; each line is one or more members that derive from real
// estimates (cached value) with an optional manual override. Two per-line toggles:
//   aggregation: 'sum' (all members add up) | 'select_one' (one selected member counts)
//   tiered:      when true (+ select_one), members are ranked Low/Mid/High
// The UI presents these as a single 3-way Mode (Add up / Pick one / Low-Mid-High).

export type BudgetAggregation = 'sum' | 'select_one';
export type BudgetTier = 'low' | 'mid' | 'high';

export interface BudgetMember {
  id: string;
  sourceEstimateId: string | null;
  tier: BudgetTier | null;
  label: string | null;
  /** Cached estimate client TOTAL at seed/refresh time. */
  derivedValue: number;
  /** Cached estimate per-person rate at seed/refresh time. */
  derivedPp: number;
  /** null → use the derived value. Interpreted per the line's isPerPerson flag. */
  overrideValue: number | null;
  /** Set when the source estimate was deleted — value is frozen at last derived/override. */
  sourceRemoved: boolean;
  rank: number;
  sortOrder: number;
}

export interface BudgetLine {
  id: string;
  eventId: string | null;
  name: string;
  aggregation: BudgetAggregation;
  tiered: boolean;
  isPerPerson: boolean;
  /** null → fall back to the event/program guest count. */
  guestCount: number | null;
  isOptional: boolean;
  /** Unchecked → displays but does NOT count toward totals. */
  isIncluded: boolean;
  selectedMemberId: string | null;
  notes: string | null;
  sortOrder: number;
  members: BudgetMember[];
}

export interface BudgetDocument {
  id: string;
  programId: string;
  title: string | null;
  status: string;
  disclaimers: string | null;
  lines: BudgetLine[];
}

/** The single 3-way mode the UI exposes, derived from the two stored toggles. */
export type BudgetMode = 'add_up' | 'pick_one' | 'tiers';

export function lineMode(line: Pick<BudgetLine, 'aggregation' | 'tiered'>): BudgetMode {
  if (line.aggregation === 'sum') return 'add_up';
  return line.tiered ? 'tiers' : 'pick_one';
}

export function modeToToggles(mode: BudgetMode): { aggregation: BudgetAggregation; tiered: boolean } {
  switch (mode) {
    case 'add_up':  return { aggregation: 'sum', tiered: false };
    case 'pick_one': return { aggregation: 'select_one', tiered: false };
    case 'tiers':   return { aggregation: 'select_one', tiered: true };
  }
}

// ── Value resolution ──────────────────────────────────────────────────────────

/** Per-unit effective value: override wins, else the derived total/pp per the pp flag. */
export function memberEffective(m: BudgetMember, isPerPerson: boolean): number {
  const base = isPerPerson ? m.derivedPp : m.derivedValue;
  return m.overrideValue ?? base;
}

/** A member's dollar contribution: pp lines multiply the rate by the guest count. */
export function memberContribution(m: BudgetMember, isPerPerson: boolean, guestCount: number): number {
  const eff = memberEffective(m, isPerPerson);
  return isPerPerson ? eff * guestCount : eff;
}

export function resolveLineGuests(line: BudgetLine, fallbackGuestCount: number): number {
  return line.guestCount ?? fallbackGuestCount;
}

/** The member that counts for a select_one/tiered line (falls back to first member). */
export function selectedMember(line: BudgetLine): BudgetMember | null {
  if (!line.members.length) return null;
  if (line.aggregation === 'sum') return null;
  return line.members.find((m) => m.id === line.selectedMemberId) ?? line.members[0];
}

export interface LineTotals {
  /** What this line contributes to the program total. */
  selected: number;
  low: number;
  high: number;
}

export function computeLineTotals(line: BudgetLine, fallbackGuestCount: number): LineTotals {
  const g = resolveLineGuests(line, fallbackGuestCount);
  const contrib = (m: BudgetMember) => memberContribution(m, line.isPerPerson, g);

  if (line.aggregation === 'sum') {
    const s = line.members.reduce((acc, m) => acc + contrib(m), 0);
    return { selected: s, low: s, high: s };
  }

  // select_one
  const sel = selectedMember(line);
  const selected = sel ? contrib(sel) : 0;
  if (line.tiered) {
    const low = line.members.find((m) => m.tier === 'low');
    const high = line.members.find((m) => m.tier === 'high');
    return {
      selected,
      low: low ? contrib(low) : selected,
      high: high ? contrib(high) : selected,
    };
  }
  return { selected, low: selected, high: selected };
}

export interface BudgetTotals {
  selected: number;
  low: number;
  high: number;
  perPerson: number;
  byEvent: Record<string, { selected: number; low: number; high: number }>;
}

const NO_EVENT_KEY = '__none__';

export function computeBudgetTotals(
  doc: BudgetDocument,
  fallbackGuestCount: number,
  programGuestCount: number,
): BudgetTotals {
  let selected = 0;
  let low = 0;
  let high = 0;
  const byEvent: BudgetTotals['byEvent'] = {};

  for (const line of doc.lines) {
    if (!line.isIncluded) continue;
    const t = computeLineTotals(line, fallbackGuestCount);
    selected += t.selected;
    low += t.low;
    high += t.high;
    const key = line.eventId ?? NO_EVENT_KEY;
    const bucket = (byEvent[key] ??= { selected: 0, low: 0, high: 0 });
    bucket.selected += t.selected;
    bucket.low += t.low;
    bucket.high += t.high;
  }

  return {
    selected,
    low,
    high,
    perPerson: programGuestCount > 0 ? selected / programGuestCount : 0,
    byEvent,
  };
}

/**
 * Rank members by their effective TOTAL value (cheapest→Low, priciest→High, middle→Mid)
 * and assign tiers. Used when a line switches into Low/Mid/High mode. Mutates a copy.
 * 1 member → low only; 2 → low/high; 3 → low/mid/high; 4+ → low / median / high.
 */
export function assignTiersByRank(members: BudgetMember[], isPerPerson = false): { id: string; tier: BudgetTier }[] {
  const sorted = [...members].sort((a, b) => memberEffective(a, isPerPerson) - memberEffective(b, isPerPerson));
  const n = sorted.length;
  if (n === 0) return [];
  if (n === 1) return [{ id: sorted[0].id, tier: 'low' }];
  if (n === 2) return [{ id: sorted[0].id, tier: 'low' }, { id: sorted[1].id, tier: 'high' }];
  const midIdx = Math.floor((n - 1) / 2);
  return sorted.map((m, i) => ({
    id: m.id,
    tier: i === 0 ? 'low' : i === n - 1 ? 'high' : i === midIdx ? 'mid' : null,
  })).filter((x): x is { id: string; tier: BudgetTier } => x.tier !== null);
}

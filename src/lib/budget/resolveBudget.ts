// Server-free, pure budget resolution for an estimate's snapshot-bar chip.
// Unifies the budget sources into one precedence. For the sources the per-person comparison
// badge considers (event-level budget, then event-linked entry), the header now matches the
// badge. An estimate-linked entry resolves first here (level 1) as the most specific budget —
// the badge does not currently consult estimate-linked entries, so the header is intentionally
// more specific in that case. No React/Supabase — fully testable.
//
// Precedence (most specific → least):
//   1. estimate-linked Budget Plan entry  (budget_plan_entries.linked_estimate_id)
//   2. event-level budget                  (events.budget_amount / budget_basis)
//   3. event-linked Budget Plan entry      (budget_plan_entries.linked_event_id, per_event)
//   4. pooled Budget Plan entry            (budget_plan_entries.entry_type = 'pooled')
//   else → none ("No budget set")

export type BudgetSource = 'estimate_entry' | 'event' | 'event_entry' | 'pooled' | 'none';

// Minimal shape of a budget_plan_entries row the resolver needs (decoupled from the DB type).
export interface BudgetEntryLike {
  entry_type: 'per_event' | 'pooled';
  pricing_basis: 'per_person' | 'flat';
  value_low: number;
  value_high: number;
  pinned_value?: number | null;
  pool_total: number | null;
  linked_event_id: string | null;
}

// Comparable budget for the per-card comparison badge (guestCount is added by the caller).
// null when the resolved budget is not a per-estimate compare target (none, or informational pooled).
export interface ResolvedBudgetTarget {
  pricingBasis: 'per_person' | 'flat';
  valueLow: number;
  valueHigh: number;
  pinnedValue: number | null;
}

export interface ResolvedBudget {
  source: BudgetSource;
  // Human label for the chip; null only when source === 'none'.
  label: string | null;
  // Structured target so the per-card badge compares against the SAME budget the header shows.
  target: ResolvedBudgetTarget | null;
}

export interface ResolveBudgetInput {
  estimateEntry: BudgetEntryLike | null;       // entry linked to this estimate
  eventId: string | null;                       // this estimate's event (if any)
  eventBudgetAmount: number | null;             // events.budget_amount
  eventBudgetBasis: 'overall' | 'per_person' | null;
  entries: BudgetEntryLike[];                   // all budget plan entries for the program
}

function fmtFlat(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}
// Per-person amounts keep cents-free but un-rounded display, matching the existing chip.
function fmtPP(v: number): string {
  return `$${v.toLocaleString('en-US')}`;
}

function labelForEntry(entry: BudgetEntryLike): string {
  const pp = entry.pricing_basis === 'per_person';
  const suffix = pp ? '/pp' : '';
  const fmt = pp ? fmtPP : fmtFlat;
  if (entry.value_low === entry.value_high) return `${fmt(entry.value_low)}${suffix}`;
  return `${fmt(entry.value_low)}–${fmt(entry.value_high)}${suffix}`;
}

function targetForEntry(entry: BudgetEntryLike): ResolvedBudgetTarget {
  return {
    pricingBasis: entry.pricing_basis,
    valueLow: entry.value_low,
    valueHigh: entry.value_high,
    pinnedValue: entry.pinned_value ?? null,
  };
}

export function resolveEstimateBudget(input: ResolveBudgetInput): ResolvedBudget {
  // 1. Estimate-linked entry — most specific.
  if (input.estimateEntry && input.estimateEntry.entry_type === 'per_event') {
    return { source: 'estimate_entry', label: labelForEntry(input.estimateEntry), target: targetForEntry(input.estimateEntry) };
  }

  // 2. Event-level budget.
  if (input.eventBudgetAmount != null && input.eventBudgetAmount > 0) {
    const pp = input.eventBudgetBasis === 'per_person';
    const amount = input.eventBudgetAmount;
    return {
      source: 'event',
      label: `${pp ? fmtPP(amount) : fmtFlat(amount)}${pp ? '/pp' : ''}`,
      target: { pricingBasis: pp ? 'per_person' : 'flat', valueLow: amount, valueHigh: amount, pinnedValue: amount },
    };
  }

  // 3. Event-linked Budget Plan entry.
  if (input.eventId) {
    const eventEntry = input.entries.find(
      (e) => e.entry_type === 'per_event' && e.linked_event_id === input.eventId,
    );
    if (eventEntry) return { source: 'event_entry', label: labelForEntry(eventEntry), target: targetForEntry(eventEntry) };
  }

  // 4. Pooled budget — informational ("part of $X pool"), never a per-estimate compare target
  //    (pooled comparison is the job of "combine" mode). A partial pool (no/zero total) is not-set.
  const pooled = input.entries.filter((e) => e.entry_type === 'pooled');
  const total = pooled.reduce((s, e) => s + (e.pool_total ?? 0), 0);
  if (pooled.length > 0 && total > 0) {
    const label = pooled.length === 1 ? `part of ${fmtFlat(total)} pool` : `part of ${fmtFlat(total)} pooled`;
    return { source: 'pooled', label, target: null };
  }

  return { source: 'none', label: null, target: null };
}

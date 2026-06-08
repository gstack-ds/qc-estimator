// Budget plan engine — pure TypeScript, no React/Next/Supabase imports.
import type { DbBudgetPlanEntry } from '@/lib/supabase/queries';

// ─── Sandbox helper ───────────────────────────────────────

// Returns the effective per-person prefill value for a budget entry.
// Uses pinned_value when set; falls back to midpoint of the low/high range.
export function effectivePrefillPP(entry: DbBudgetPlanEntry): number {
  if (entry.pinned_value !== null && entry.pinned_value !== undefined) {
    return entry.pinned_value;
  }
  return (entry.value_low + entry.value_high) / 2;
}

// ─── Rollup types ─────────────────────────────────────────

export interface BudgetRollupRow {
  entryId: string;
  label: string;
  entryType: 'per_event' | 'pooled';
  pricingBasis: 'per_person' | 'flat';
  targetLow: number;
  targetHigh: number;
  pinnedTarget: number;
  actualTotal: number | null;
  variance: number | null;    // actualTotal - pinnedTarget; positive = over budget
  pctFilled: number | null;   // for pooled: actualTotal / pool_total
}

export interface BudgetRollup {
  rows: BudgetRollupRow[];
  totalLow: number;
  totalHigh: number;
  totalPinnedTarget: number;
  totalActual: number | null;  // null when no entries have actuals
}

// ─── effectivePinned (rollup alias, same as effectivePrefillPP) ───────────

// Named separately for semantic clarity in rollup context.
export function effectivePinned(entry: DbBudgetPlanEntry): number {
  return effectivePrefillPP(entry);
}

// ─── Rollup engine ────────────────────────────────────────

export function calculateBudgetRollup(
  entries: DbBudgetPlanEntry[],
  // Map of estimate_id → committed total client cost (from cacheEstimateTotal)
  estimateTotals: Record<string, number>,
  programGuestCount: number,
): BudgetRollup {
  let totalLow = 0;
  let totalHigh = 0;
  let totalPinnedTarget = 0;
  let hasAnyActual = false;
  let totalActualSum = 0;

  const rows: BudgetRollupRow[] = entries.map((e) => {
    // ── Pooled entry: all targets = pool_total ───────────
    if (e.entry_type === 'pooled') {
      const pool = e.pool_total ?? 0;
      const actualTotal = e.linked_estimate_id != null
        ? (estimateTotals[e.linked_estimate_id] ?? null)
        : null;
      const pctFilled = actualTotal != null && pool > 0 ? actualTotal / pool : null;
      const variance = actualTotal != null ? actualTotal - pool : null;
      totalLow += pool;
      totalHigh += pool;
      totalPinnedTarget += pool;
      if (actualTotal != null) { hasAnyActual = true; totalActualSum += actualTotal; }
      return {
        entryId: e.id, label: e.label, entryType: 'pooled', pricingBasis: e.pricing_basis,
        targetLow: pool, targetHigh: pool, pinnedTarget: pool,
        actualTotal, variance, pctFilled,
      };
    }

    // ── Per-event entry ──────────────────────────────────
    const pinned = effectivePinned(e);

    if (e.pricing_basis === 'flat') {
      const low = e.value_low;
      const high = e.value_high;
      const pinnedTarget = e.pinned_value ?? (low + high) / 2;
      const actualTotal = e.linked_estimate_id != null
        ? (estimateTotals[e.linked_estimate_id] ?? null)
        : null;
      const variance = actualTotal != null ? actualTotal - pinnedTarget : null;
      totalLow += low;
      totalHigh += high;
      totalPinnedTarget += pinnedTarget;
      if (actualTotal != null) { hasAnyActual = true; totalActualSum += actualTotal; }
      return {
        entryId: e.id, label: e.label, entryType: 'per_event', pricingBasis: 'flat',
        targetLow: low, targetHigh: high, pinnedTarget,
        actualTotal, variance, pctFilled: null,
      };
    }

    // per_person: multiply by effective guest counts
    const guestLow  = e.guest_low  ?? programGuestCount;
    const guestHigh = e.guest_high ?? programGuestCount;
    const guestPinned = e.guest_low != null && e.guest_high != null
      ? (e.guest_low + e.guest_high) / 2
      : programGuestCount;

    const targetLow  = e.value_low  * guestLow;
    const targetHigh = e.value_high * guestHigh;
    const pinnedTarget = pinned * guestPinned;

    const actualTotal = e.linked_estimate_id != null
      ? (estimateTotals[e.linked_estimate_id] ?? null)
      : null;
    const variance = actualTotal != null ? actualTotal - pinnedTarget : null;

    totalLow += targetLow;
    totalHigh += targetHigh;
    totalPinnedTarget += pinnedTarget;
    if (actualTotal != null) { hasAnyActual = true; totalActualSum += actualTotal; }

    return {
      entryId: e.id, label: e.label, entryType: 'per_event', pricingBasis: 'per_person',
      targetLow, targetHigh, pinnedTarget,
      actualTotal, variance, pctFilled: null,
    };
  });

  return {
    rows,
    totalLow,
    totalHigh,
    totalPinnedTarget,
    totalActual: hasAnyActual ? totalActualSum : null,
  };
}

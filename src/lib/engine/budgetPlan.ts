// Budget plan engine — pure TypeScript, no React/Next/Supabase imports.
import type { DbBudgetPlanEntry } from '@/lib/supabase/queries';

// Returns the effective per-person prefill value for a budget entry.
// Uses pinned_value when set; falls back to midpoint of the low/high range.
export function effectivePrefillPP(entry: DbBudgetPlanEntry): number {
  if (entry.pinned_value !== null && entry.pinned_value !== undefined) {
    return entry.pinned_value;
  }
  return (entry.value_low + entry.value_high) / 2;
}

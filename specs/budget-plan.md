# Budget Plan — Feature Spec

## Goal
Program-level budget planning layer that maps to events/estimates, with dynamic two-way targets.

## Four phases, committed separately

### Phase 1 — Data model + program Budget Plan UI
- Migration 040: `budget_plan_entries` table
- `DbBudgetPlanEntry` type + queries in `queries.ts`
- Server actions in `programs/actions.ts`
- `BudgetPlanSection` component on program page (Phase 1: CRUD only, no rollup)

### Phase 2 — Reverse workback at range (tests first)
- `reverseCalculateBudgetTargetRange()` in `restaurantBudgetTarget.ts`
- Round-trip tests at both ends + pinned midpoint
- `BudgetTargetRangeInput/Result` types

### Phase 3 — Estimate sandbox (tests first)
- `effectivePrefillPP(entry)` pure helper + tests
- `applyBudgetPin(entryId, pinnedValue)` server action
- `EstimateBuilder`: pre-fill from linked entry, "Apply to Budget Plan" button + confirm modal
- Estimate page: fetch linked budget entry, pass to builder

### Phase 4 — Program-level rollup (tests first)
- `calculateBudgetRollup()` + `effectivePinned()` in `src/lib/engine/budgetPlan.ts`
- Rollup tests: per-event pp, per-event flat, pooled, mixed, actuals, totals
- `BudgetPlanSection`: add rollup table in Phase 4 update
- Program page: pass `estimateTotals` map to section

## Key files
- `supabase/migrations/040_budget_plan_entries.sql`
- `src/lib/supabase/queries.ts` — DbBudgetPlanEntry, getBudgetPlanEntries, getBudgetPlanEntryForEstimate
- `src/app/(programs)/programs/actions.ts` — addBudgetEntry, updateBudgetEntry, deleteBudgetEntry, applyBudgetPin
- `src/lib/engine/restaurantBudgetTarget.ts` — extended with range types/function
- `src/lib/engine/budgetPlan.ts` — new, rollup engine
- `src/components/programs/BudgetPlanSection.tsx` — new
- `src/app/(programs)/programs/[id]/page.tsx` — fetch + render section
- `src/app/(programs)/programs/[id]/estimates/[estimateId]/page.tsx` — fetch linked entry
- `src/components/estimates/EstimateBuilder.tsx` — pre-fill + Apply button

## Migration note
Run migration 040 after Gary reviews it. App will compile without it but actions will fail at runtime.

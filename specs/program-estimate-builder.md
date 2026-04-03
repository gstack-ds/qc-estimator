# Spec: Program Setup + Venue Estimate Builder

## Goal
Build the two core features: Program Setup (/programs/[id]) and the Venue Estimate Builder (/programs/[id]/estimates/[estimateId]), wired to the existing pricing engine for real-time calculations.

## Architecture

### Data flow
Server Component fetches → passes as props → Client Component holds local state → pricing engine runs on every state change → Server Actions persist on blur/change.

### Engine
Engine is unchanged for now except: add `clientCostOverride?: number` to LineItem (with test). When present, skips markup formula and uses the override as clientCost. This enables the "Custom" category.

### Auto-save strategy
- Program form fields: `onBlur` for text inputs, `onChange` for selects/toggles
- Line item fields: `onBlur` — optimistic update to local state, async persist
- Status indicator: "Saving..." / "Saved" / error in header

## Key Files

```
supabase/migrations/002_add_custom_price.sql
src/types/index.ts                                     add clientCostOverride
src/lib/engine/pricing.ts                              handle clientCostOverride
tests/unit/pricing.test.ts                             custom override test
src/lib/supabase/queries.ts                            extend: programs, estimates, line items
src/app/(programs)/layout.tsx
src/app/(programs)/programs/page.tsx                   programs list
src/app/(programs)/programs/new/page.tsx
src/app/(programs)/programs/[id]/page.tsx              program detail + estimate list
src/app/(programs)/programs/[id]/estimates/[estimateId]/page.tsx
src/app/(programs)/programs/actions.ts                 program CRUD + estimate create
src/app/(programs)/programs/[id]/estimates/actions.ts  estimate + line item CRUD
src/components/estimates/ProgramForm.tsx
src/components/estimates/EstimateBuilder.tsx           main client component
src/components/estimates/LineItemSection.tsx
src/components/estimates/LineItemRow.tsx
src/components/estimates/SummaryPanel.tsx
src/components/estimates/MarginPanel.tsx
src/components/estimates/ScenarioTabs.tsx
```

## Custom Category
- Dropdown includes "Custom" as special option (id = null, markupPct = 0)
- When selected: show "Our Cost" + "Client Price" inputs side by side
- Stored in DB as custom_client_unit_price; engine receives clientCostOverride = qty × customClientUnitPrice

## Section → tax type mapping
- F&B: per-item food/alcohol toggle (default: food)
- Equipment & Staffing: fixed general
- Venue Fees: general (but tax controlled by isVenueTaxable estimate flag)
- Non-Taxable Staffing: fixed none

## Done When
- [ ] /programs lists all programs, "New Program" creates one
- [ ] Program form auto-saves on field change
- [ ] "Add Estimate" creates a venue estimate and redirects to builder
- [ ] Estimate builder shows 4 line item sections with add/delete
- [ ] Summary panel updates in real-time as user edits line items
- [ ] Margin panel shows QC margin, team hours, true net
- [ ] Scenario tabs switch between estimates in same program
- [ ] "Duplicate" copies estimate + all line items
- [ ] Fee overrides show yellow highlight when different from program defaults
- [ ] F&B minimum status indicator shows met/not met + shortfall
- [ ] All 26+ tests pass

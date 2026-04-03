# Spec: Session 4 — Export, Roles, Markup Override, Polish

## Engine change (tests first)
Add fbFoodSubtotalClient + fbAlcoholSubtotalClient to EstimateSummary so Copy Numbers can split Menu vs Bar.

## Migration 003
- profiles (user_id, role 'user'|'admin', name) + RLS + trigger to auto-create on signup
- estimate_line_items.markup_override NUMERIC(6,4) nullable
- estimates.cached_total NUMERIC(12,2) nullable  
- programs.latest_total NUMERIC(12,2) nullable

## Per-line-item markup override
- LocalLineItem gets defaultMarkupPct (from category ref) + categoryMarkupPct (effective = override ?? default)
- LineItemRow: editable markup % field; yellow bg when overridden (effective != default)
- Category change resets both to new category default; markup_override = null
- Constrain 5%-300% on blur
- Persists as markup_override on line item

## Export
- ExportButtons client component (Copy Numbers + Export to Excel)
- Copy Numbers: formats Menu/Bar/Staffing/Equipment/Venue/SvcCharge/Gratuity/AdminFee/Tax/ProdFee/Total with per-person prices, copies to clipboard, shows "Copied!" toast
- Export to Excel: server action getExportDataForProgram fetches all estimates → client builds xlsx with one sheet per estimate via xlsx library

## Role-based access
- getProfile(userId) query
- Layouts fetch profile server-side, filter nav links (non-admin sees no Reference Data link)
- (admin)/layout redirects non-admin to /programs
- Note: Gary must manually set his profile.role = 'admin' after migration

## Polish
- cacheEstimateTotal(estimateId, programId, total) action — EstimateBuilder calls via useEffect (2s debounce) when summary.totalClient changes
- Dashboard latest_total: getPrograms returns programs.latest_total
- ProgramsTable: add Latest Total column (gray "—" when null)
- Delete Program: DeleteProgramButton client component with inline confirm → deleteProgram action → redirect /programs
- EstimateBuilder empty state: when all sections have 0 items, show centered prompt
- LineItemSection: richer empty state per section

## Key files
supabase/migrations/003_profiles_markup_cache.sql
src/types/index.ts — EstimateSummary additions
src/lib/engine/pricing.ts — food/alcohol subtotals
tests/unit/pricing.test.ts — new tests
src/lib/supabase/queries.ts — getProfile, updated getPrograms, updated DbLineItem
src/app/(programs)/programs/actions.ts — deleteProgram
src/app/(programs)/programs/[id]/estimates/actions.ts — markup_override in upsertLineItem, cacheEstimateTotal, getExportDataForProgram
src/components/estimates/EstimateBuilder.tsx — LocalLineItem.defaultMarkupPct, cache effect, ExportButtons
src/components/estimates/LineItemRow.tsx — markup override field
src/components/estimates/ExportButtons.tsx — NEW
src/components/estimates/DeleteProgramButton.tsx — NEW
src/app/(programs)/programs/[id]/page.tsx — add DeleteProgramButton
src/app/(programs)/programs/page.tsx — pass programs with latest_total
src/components/estimates/ProgramsTable.tsx — latest_total column
src/app/(admin)/layout.tsx — role check + redirect
src/app/(programs)/layout.tsx — filter nav by role

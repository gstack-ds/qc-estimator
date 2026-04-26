# Transportation Estimate Builder

## Goal
Add Transportation as a 4th estimate type alongside Venue, AV, and Decor.
It has its own vehicle rate card, daily schedule, per-estimate commission (default 0),
and uses general sales tax from the program's location.

## Data Model

### Migration 011
- `transport_vehicle_rates` — per-estimate vehicle rate card rows
  - id, estimate_id, vehicle_type (text, e.g. "Suburban (6 pax)"), hourly_rate, hour_minimum (nullable), sort_order
- `transport_schedule_rows` — per-estimate daily schedule rows
  - id, estimate_id, service_date (date, nullable), vehicle_rate_id (FK nullable), service_type ('hourly'|'transfer'), start_time (text HH:MM), end_time (text HH:MM), qty, our_cost (stored, numeric), client_cost (stored, numeric), notes, sort_order
- `estimates.transport_commission NUMERIC` — per-estimate commission, defaults to 0 for transportation estimates

`our_cost` and `client_cost` are stored (not just computed) so the comparison view can aggregate with a simple SUM.

### Why store our_cost / client_cost
- Comparison view needs aggregates without complex JOIN + math
- Decouples schedule rows from future rate changes (quoted cost is preserved)

## Pricing Engine (src/lib/engine/transportation.ts)
Pure functions only — no imports outside types.
- `TRANSPORT_MARKUP = 0.75`
- `calcClientRate(rate)` — rate × 1.75, round to nearest $10
- `calcHoursFromTimes(start, end)` — handles midnight crossing
- `calcBilledHours(type, start, end, hourMinimum)` — transfer=1, hourly=max(raw, minimum)
- `calcOurCost(hourlyRate, hours, qty)`
- `calcClientCost(clientRate, hours, qty)`
- `calcTransportSummary(rows, taxRate, ccFee, commission)` → subtotals, tax, productionFee, total, qcMarginPct

Summary formula:
- subtotalClient = Σ clientCost
- tax = subtotalClient × generalTaxRate
- markupRevenue = subtotalClient - subtotalOur
- productionFee = subtotalClient × ccFee + markupRevenue × transportCommission
- totalClient = subtotalClient + tax + productionFee
- qcMarginPct = (markupRevenue - productionFee) / totalClient

## Component: TransportationEstimateBuilder.tsx
Two-column layout: main content left, summary sidebar right (same as other builders).

### Sections (top to bottom in main column):
1. Header row: estimate name (editable), Notes
2. AttachmentsPanel (estimateType="transportation")
3. Vehicle Rate Card table — editable, add/remove rows
   - Columns: Vehicle Type | Hourly Rate | Hour Minimum | Client Rate (computed, read-only)
4. Daily Schedule table — editable, add/remove rows
   - Columns: Date | Vehicle | Service Type | Start | End | Hours (computed) | Qty | Our Cost | Client Cost | Notes | Delete
   - Hour Minimum shown only when service_type === 'hourly'
5. Totals inline below schedule table

### Sidebar:
- Commission field (default 0, NOT pulled from program)
- Summary: Subtotal | Tax | Commission (production fee) | Total
- Margin analysis (QC Margin + health badge)

## Files Changed
1. `supabase/migrations/011_transportation_estimates.sql` — NEW
2. `src/lib/engine/transportation.ts` — NEW
3. `src/components/estimates/TransportationEstimateBuilder.tsx` — NEW
4. `src/types/index.ts` — Add 'transportation' to EstimateType
5. `src/app/(programs)/programs/actions.ts` — createEstimate transportation case
6. `src/app/(programs)/programs/[id]/estimates/actions.ts` — transport CRUD + extraction prompt
7. `src/lib/supabase/queries.ts` — add transport queries + DbEstimate.transport_commission
8. `src/app/(programs)/programs/[id]/estimates/[estimateId]/page.tsx` — route to Transportation builder
9. `src/app/(programs)/programs/[id]/page.tsx` — handle transportation in comparison view
10. `src/components/estimates/AddEstimateButton.tsx` — add 'transportation' option
11. `src/components/estimates/AttachmentsPanel.tsx` — add 'transportation' to estimateType union

## Done When
- Add Estimate dropdown shows Transportation
- Transportation estimate opens TransportationEstimateBuilder
- Vehicle rate card is editable (add/remove rows, client rate auto-rounds to $10)
- Daily schedule rows auto-calculate hours, our_cost, client_cost on change
- Hour minimum only enforced for hourly service type
- Commission defaults to 0, not pulled from program
- Tax = general_sales from location
- Summary sidebar updates live
- Margin analysis shows
- AttachmentsPanel works with transportation extraction prompt
- Comparison view shows correct total and margin for transportation estimates

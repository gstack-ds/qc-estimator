# EEG Commission

## Goal
A per-estimate, client-visible commission paid to a third party (EEG). Mirrors the Client Discount
mechanism (toggle + editable rate + optional line) but is an ADDITION to the total, not a subtraction.

## Confirmed decisions
- **Scope:** per estimate (like the discount), not program-wide.
- **Toggle:** OFF by default. OFF → no line, total identical to today. ON → line shows, total includes it.
- **Base:** `rate × preTaxTotal` (the "Pre-Tax Total" line = Subtotal + Production Fee, the line right before Tax). [confirmed by Alex — revised from the earlier subtotal-only base]
- **Rate:** editable, default 10% (stored as decimal 0.10). UI: type `10`, store `0.10`.
- **Tax:** computed on the pre-tax subtotal but added AFTER tax; itself NOT taxed; does not change the tax figure.
- **Margin:** pass-through / margin-neutral [confirmed]. QC margin $ and % are identical on/off — the
  commission is backed out of the client total in `calculateMarginAnalysis` (it is NOT QC revenue).

## Total stack (toggle ON)
```
Subtotal (pre-tax)   = lineItemsSubtotalClient
+ Production Fee      = productionFee
= Pre-Tax Total      = preTaxTotal
+ Tax                = foodTax+alcoholTax+equipmentTax+venueTax+productionFeeTax   (unchanged by EEG)
+ EEG Commission     = rate × preTaxTotal (Subtotal + Production Fee)              (after tax, untaxed)
= Grand Total        = totalClient
```

## Files
- **Engine** `src/lib/engine/pricing.ts` — compute `eegCommissionAmount`; `totalClient = totalClientPreDiscount − discountAmount + eegCommissionAmount`; in `calculateMarginAnalysis`, use `marginClientTotal = totalClient − eegCommissionAmount` everywhere `totalClient` was used (gdp base, qcRevenue, margin %, team hours, true net) → margin-neutral.
- **Types** `src/types/index.ts` — `VenueEstimateInput.eegCommission?: { rate } | null`; `EstimateSummary.eegCommissionAmount`.
- **DB** `supabase/migrations/056_eeg_commission.sql` — `eeg_enabled BOOLEAN NOT NULL DEFAULT false`, `eeg_rate NUMERIC(6,4) NOT NULL DEFAULT 0.10`. Migration number 056 (053 is the known manual gap; 055 is the highest repo file).
- **Data layer** `queries.ts` (row type + `ESTIMATE_FIELDS`), `actions.ts` (`updateEstimate` partial + duplicate copy), `deckContract.ts` (pass input for total parity), `mcp-server/.../estimates.ts` (select cols).
- **Builders** (toggle + editable rate, save, engine input): `EstimateBuilder` (venue), `AvEstimateBuilder`, `DecorEstimateBuilder`, `TourEstimateBuilder`. (Transportation has no discount/EEG — uses its own commission model.)
- **Summary panels** (row after tax): `SummaryPanel`, `AvSummaryPanel`, `DecorSummaryPanel` (Tour reuses Decor's).
- **Proposal PDF** `ProposalDocument.tsx` — EEG row after Tax, before Grand Total (copper, `+`).
- **Tests** `tests/unit/pricing.test.ts` — EEG suite (OFF unchanged, ON = rate×subtotal, base check, after-tax, tax/subtotal/fee unaffected, delta = commission, editable rate, margin-neutral incl. GDP, coexists with discount, per-person includes it).

## Done criteria
- Toggle OFF → estimate/total byte-identical to pre-feature behavior; no line anywhere.
- Toggle ON → commission = rate × pre-tax total (Subtotal + Production Fee), added after tax; tax unchanged; grand total = pre-tax total + tax + commission; line shows on PDF + on-screen + builder; rate editable.
- Margin neutral on/off. All tests green. Migration run in Supabase before relying on writes.

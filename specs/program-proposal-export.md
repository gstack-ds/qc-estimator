# Program-Level Combined Proposal Export

## Goal
Generate ONE combined proposal PDF covering multiple estimates in a program, alongside the existing
per-estimate export (both stay). Each estimate is its own section with its own subtotal/tax/commission;
a program grand total sums them.

## Prerequisite (confirmed)
`fix/proposal-pdf-section-wrap` is in main (8616ebf); `wrap={false}` present in ProposalDocument. The
combined doc reuses the same section-rendering block, so the wrap fix carries over automatically.

## Wizard (client modal, launched from program page toolbar — next to Generate Deck)
1. SELECT — all program estimates listed, checkboxes, ALL checked by default; deselect to exclude.
2. REORDER — drag to set section order (dnd-kit). Default = program order (sort_order).
3. GENERATE — server action gathers payloads → client renders combined PDF via @react-pdf.

## Document structure
- Program cover/header (program + client name) — mirrors the existing proposal header.
- Each selected estimate (in chosen order) = its own section: estimate title + its line-item sections
  (reusing ProposalDocument's section block — same-name sections stay distinct per estimate via the
  section-id grouping) + its OWN totals (subtotal/prodfee/pre-tax/tax/discount/EEG/total). Each estimate
  starts on a new page (`break`) except the first, for readability.
- Program grand total at the end: Σ subtotals, Σ production fees, Σ pre-tax totals, Σ taxes,
  Σ discounts, Σ EEG commissions, Σ final totals. Each estimate's tax stays its own (different
  jurisdictions never blend).

## Math (NO engine change)
Aggregates already-computed per-estimate `EstimateSummary` values. `computeProgramGrandTotal` sums
lineItemsSubtotalClient / productionFee / preTaxTotal / per-estimate tax / discountAmount /
eegCommissionAmount / totalClient. Invariant per estimate (preserved by summing):
total = preTaxTotal + ownTax − discount + eeg.

## Approach (reuse-first)
- **Per-estimate summary:** reuse `buildDeckContract` (the blessed shared builder — calls the engine,
  applies per-estimate tax overrides). Take `contract.summary`.
- **Display line items:** map raw rows → `LineItemForExport` (pure `rawLineItemToExportItem`, mirrors
  the builders' `dbItemToLocal`). orderedSections from raw estimate_sections sorted by sort_order.
- **Effective location:** `effectiveLocation(programLocation, estimate overrides)` for the tax column.
- Client-render pattern (same as per-estimate export): server action returns JSON payloads; the button
  dynamic-imports @react-pdf + ProgramProposalDocument and downloads the blob. Keeps @react-pdf out of
  the server bundle.

## Files
- `src/lib/proposals/programProposal.ts` (pure, server-free, tested): types (EstimateProposalPayload,
  ProgramProposalData, ProgramGrandTotal), `rawLineItemToExportItem`, `effectiveLocation`,
  `estimateTax`, `computeProgramGrandTotal`.
- `src/components/export/ProposalDocument.tsx`: extract `EstimateLineItemSections`, `EstimateTotals`,
  `TourLogisticsBlock` as exported sub-components; ProposalDocument uses them (behavior unchanged).
- `src/components/export/ProgramProposalDocument.tsx`: the combined doc.
- server action `getProgramProposalData(programId, estimateIdsInOrder)` (estimates/actions.ts).
- `src/components/programs/ExportFullProposalButton.tsx`: the 3-step wizard.
- `src/app/(programs)/programs/[id]/page.tsx`: button in the toolbar + pass the estimate list.
- Tests: `tests/unit/programProposal.test.ts`.

## Migration
None — read/render over existing data.

## Done criteria / tests
- Grand total sums multiple estimates' pre-tax totals/taxes/commissions/finals, incl. estimates with
  different tax rates and some with EEG on.
- Deselected estimates excluded; reorder changes section order (order preserved by the payload array).
- Same-name sections across estimates never merge (each estimate rendered separately; grouping is per
  estimate's own sectionId list).
- Long sections still flow across pages in the combined doc (wrap fix holds).
- Single-estimate export unchanged. All tests green.

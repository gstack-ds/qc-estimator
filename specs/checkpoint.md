# Session Checkpoint — 2026-04-26

## What Was Done

### Bug 1: Client commission resets to 5% — FIXED
- Root cause: `parseFloat(clientComm) / 100 || 0.05` — JS treats `0` as falsy, so 0% always saved as 5%.
- Same bug in `cc_processing_fee` (`|| 0.035`).
- Fix: replaced `|| fallback` with `isNaN(v) ? fallback : v / 100` in both `onBlur` handlers and `handleCreate` in `ProgramForm.tsx`.

### Bug 2: Category selections reset to "none" — FIXED
- Root cause: stale closure in all three builders. The `onChange` inline handler captured `handleItemSave` from the current render (with old `lineItems`). When `setTimeout(() => handleItemSave(id), 0)` fired, it called the stale function which found the item with the old `categoryId: null`.
- Fix: added `lineItemsRef` pattern to `EstimateBuilder`, `AvEstimateBuilder`, `DecorEstimateBuilder`. All three now use `lineItemsRef.current` inside `handleItemSave`, `handleItemDelete`, and `handleAddItem` instead of the closed-over `lineItems` state. Removed `lineItems` from those `useCallback` deps.

### Feature 1: Copy Line Items export — DONE
- Added `buildLineItemsCopyText()` to `src/lib/utils/export.ts` — outputs tab-separated rows: Item Name / Qty / Unit Price / Total. Client-facing prices only (no internal cost or markup).
- Added "Copy Line Items" button to `ExportButtons.tsx` (sits between Copy Numbers and Export to Excel).

### Feature 2: Line Item Templates — DONE
- Migration `007_line_item_templates.sql`: creates `line_item_templates` table with RLS (authenticated read all; own insert/delete).
- Server actions in estimates `actions.ts`: `getTemplates()`, `saveTemplate()`, `deleteTemplate()`.
- `TemplatePickerDropdown.tsx`: lazy-loads templates when opened, searchable, click-to-add, delete (own templates, hover-to-reveal).
- `LineItemRow.tsx`: added `onSaveAsTemplate` optional prop + star (☆/★) icon in new 9th column. Saves name/category/unit price/tax type.
- `LineItemSection.tsx`: added `onAddFromTemplate` optional prop + "+ From template" button that opens the picker. Header columns updated to match 9-column layout.
- All three builders: wired `handleSaveAsTemplate` and `handleAddFromTemplate` callbacks into `LineItemSection`.

### Feature 3: Copy Items From — DONE
- Server action `getLineItemsForEstimate(estimateId)` in estimates `actions.ts`.
- `CopyItemsFromButton.tsx`: dropdown of other estimates in same program; hidden when none exist. Selecting one fetches line items and calls `onImport` with converted `LocalLineItem[]`.
- All three builders: wired `handleImportItems` callback. Button placed in header bar before ExportButtons.

## Current State
- 74 tests passing (no new tests added — new logic is UI-layer / integration-layer only)
- TypeScript: no errors
- Branch: `fix/commission-and-category-persist` (3 commits ahead of main)

## Migration Needed
- `007_line_item_templates.sql` must be applied in Supabase before templates work.

## Known Issues / Next Steps
- **Merge PR** when ready: `fix/commission-and-category-persist`
- **Remaining from PRD**:
  - Validate against 3-5 real historical proposals
  - PDF/Canva client-facing export
  - Mobile polish
  - Role-based access enforcement in UI

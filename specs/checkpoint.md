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
- Migration `007_line_item_templates.sql`: creates `line_item_templates` table with RLS (authenticated read all; own insert/delete). **NOT YET APPLIED TO SUPABASE.**
- Server actions in estimates `actions.ts`: `getTemplates()`, `saveTemplate()`, `deleteTemplate()`.
- `TemplatePickerDropdown.tsx`: lazy-loads templates when opened, searchable, click-to-add, delete (own templates, hover-to-reveal).
- `LineItemRow.tsx`: added `onSaveAsTemplate` optional prop + star (☆/★) icon in new 9th column. Saves name/category/unit price/tax type.
- `LineItemSection.tsx`: added `onAddFromTemplate` optional prop + "+ From template" button that opens the picker. Header columns updated to match 9-column layout.
- All three builders: wired `handleSaveAsTemplate` and `handleAddFromTemplate` callbacks into `LineItemSection`.

### Feature 3: Copy Items From — DONE
- Server action `getLineItemsForEstimate(estimateId)` in estimates `actions.ts`.
- `CopyItemsFromButton.tsx`: dropdown of other estimates in same program; hidden when none exist. Selecting one fetches line items and calls `onImport` with converted `LocalLineItem[]`.
- All three builders: wired `handleImportItems` callback. Button placed in header bar before ExportButtons.

### Feature 4: Claude API PDF Extraction — DONE
- `@anthropic-ai/sdk` installed (v0.91.1).
- Migration `008_extracted_data.sql`: adds `extracted_data JSONB` to `estimate_attachments`. **NOT YET APPLIED TO SUPABASE.**
- New types in `actions.ts`: `ExtractedMenuItem`, `ExtractedVenueFee`, `ExtractedData`.
- `AttachmentRecord` updated to include `extracted_data`.
- Server action `extractAttachmentData(attachmentId)`: downloads PDF from Supabase Storage → base64 → `claude-sonnet-4-6` with document block → parses JSON → stores in DB.
- `AttachmentsPanel.tsx` fully rewritten: auto-triggers extraction on PDF upload, per-record state (idle/extracting/error/done), seeded from DB on load, "Extract menu data" link for existing PDFs, retry on error, results table (menu items + venue fees), "Copy to Canva" button, "Populate Line Items" button (optional prop).
- `EstimateBuilder.tsx`: new `handlePopulateFromExtraction` callback — maps extracted items to `LocalLineItem[]` (Catering & F&B markup, `program.guest_count` as qty, food/alcohol/none tax types), wired into `AttachmentsPanel`. AV and Decor builders do not wire this prop (button hidden).

## Current State
- 74 tests passing (no new tests added — all new logic is UI/integration layer)
- TypeScript: no errors
- Branch: `fix/commission-and-category-persist` (5 commits ahead of main)

## ⚠️ Migrations Needed — BLOCKING
Apply in Supabase SQL Editor before testing new features:
1. `007_line_item_templates.sql` — templates + copy items from
2. `008_extracted_data.sql` — PDF extraction

Also add `ANTHROPIC_API_KEY` to `.env.local` and Vercel env vars.

## Known Issues / Next Steps
- **Merge PR** when ready: `fix/commission-and-category-persist`
- **Apply migrations** 007 and 008 in Supabase
- **Add ANTHROPIC_API_KEY** to env
- **Remaining from PRD**:
  - Validate against 3-5 real historical proposals
  - PDF/Canva client-facing export
  - Mobile polish
  - Role-based access enforcement in UI

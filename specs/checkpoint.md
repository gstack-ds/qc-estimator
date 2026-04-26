# Session Checkpoint — 2026-04-26

## What Was Done

### Bug 1: Client commission resets to 5% — FIXED
- Root cause: `parseFloat(clientComm) / 100 || 0.05` — JS treats `0` as falsy, so 0% always saved as 5%.
- Fix: replaced `|| fallback` with `isNaN(v) ? fallback : v / 100` in both `onBlur` handlers and `handleCreate` in `ProgramForm.tsx`.

### Bug 2: Category selections reset to "none" — FIXED
- Root cause: stale closure in all three builders. Fix: `lineItemsRef` pattern in `EstimateBuilder`, `AvEstimateBuilder`, `DecorEstimateBuilder`.

### Feature 1: Copy Line Items export — DONE
- `buildLineItemsCopyText()` in `src/lib/utils/export.ts`. "Copy Line Items" button in `ExportButtons.tsx`.

### Feature 2: Line Item Templates — DONE
- Migration `007_line_item_templates.sql`. Server actions: `getTemplates()`, `saveTemplate()`, `deleteTemplate()`.
- `TemplatePickerDropdown.tsx`, star icon in `LineItemRow.tsx`, "+ From template" in `LineItemSection.tsx`.

### Feature 3: Copy Items From — DONE
- `getLineItemsForEstimate()` server action. `CopyItemsFromButton.tsx` dropdown, wired in all three builders.

### Feature 4: Claude API PDF Extraction (Venue Estimates) — DONE
- Migration `008_extracted_data.sql`: adds `extracted_data JSONB` to `estimate_attachments`.
- `extractAttachmentData()` server action: downloads PDF → base64 → `claude-sonnet-4-6` → stores JSON in DB.
- `AttachmentsPanel.tsx`: auto-triggers extraction on PDF upload, seeds results from DB on page load.

### Feature 5: PDF Brief Extraction on New Program Page — DONE
- Migration `009_program_attachments.sql`: creates `program_attachments` table with `extracted_data JSONB`.
- `extractProgramBrief()` + `uploadProgramAttachment()` server actions in `programs/actions.ts`.
- `ProgramForm.tsx`: dropzone at top (create mode only), auto-fills fields, green toast.

### Feature 6: Populate Estimate Details — DONE
- "Populate Estimate Details" button in `AttachmentsPanel.tsx` fills Estimate Name, Room/Space, F&B Minimum, Service Charge, Gratuity, Admin Fee from extracted PDF data.

### Feature 7: Estimate-Type-Aware PDF Extraction — DONE
- Three extraction prompts: venue (menuItems + equipmentItems + venueFees), AV (avItems → equipmentItems), Decor (decorItems → equipmentItems).
- `ExtractedEquipmentItem.section` covers all item types across all three estimate types.
- `AttachmentsPanel` passes `estimateType` to `extractAttachmentData`; displays equipment/AV/decor table alongside menu items table.
- `AvEstimateBuilder`: `handlePopulateFromExtraction` maps equipment→Equipment & Staffing/AV markup, labor→Non-Taxable Staffing/Staffing markup.
- `DecorEstimateBuilder`: maps florals/lighting/signage→Florals-Taxable/Décor markup, rentals→Rentals-Rugs/Décor markup, delivery→Florals-Non-Taxable/Delivery markup.
- `EstimateBuilder`: handles both menuItems (→F&B) and equipmentItems (→Equipment/Venue Fees/Non-Taxable Staffing).

### Bug 3: Extraction results not persisting across page loads — FIXED
- Root cause: the seeding code in `load()` was correct, but auto-trigger on upload was overwriting in-memory state before users could verify the flow. Also added "✓ AI extracted" badge so users can see data loaded from DB.
- Fix: seeding in `load()` always renders stored DB results. Auto-trigger on upload is guarded by `record.extracted_data === null` (always true for new uploads since insert never sets it). Manual "Extract" link remains for attachments without stored data.

### Bug 4: Duplicate populate actions — FIXED
- `populatedLineItems` and `populatedDetails` Sets track which attachments have been actioned.
- Buttons switch to "Line Items Added ✓" / "Details Applied ✓" (green, disabled) after first click.
- Both sets reset when `triggerExtraction` is called for that attachment (re-extraction = fresh state).

## Current State
- 74 tests passing (no new tests — all new logic is UI/integration layer)
- TypeScript: no errors
- Branch: `fix/commission-and-category-persist` (11 commits ahead of main)

## ⚠️ Migrations Needed — BLOCKING
Apply in Supabase SQL Editor before testing new features:
1. `007_line_item_templates.sql` — templates + copy items from
2. `008_extracted_data.sql` — PDF extraction on estimate attachments
3. `009_program_attachments.sql` — PDF brief upload on New Program page

Also add `ANTHROPIC_API_KEY` to `.env.local` and Vercel env vars.

## Known Issues / Next Steps
- **Merge PR** when ready: `fix/commission-and-category-persist`
- **Apply migrations** 007, 008, 009 in Supabase
- **Add ANTHROPIC_API_KEY** to env
- **Remaining from PRD**:
  - Validate against 3-5 real historical proposals
  - PDF/Canva client-facing export
  - Mobile polish
  - Role-based access enforcement in UI

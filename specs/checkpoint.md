# Session Checkpoint — 2026-04-21

## What Was Done

### 1. Copy Numbers export fix + tests
- Extracted all export helpers (`buildCopyText`, `buildSummaryRows`, `itemClientCost`, `splitStaffingEquipment`, `fmtAmt`) from `ExportButtons.tsx` into `src/lib/utils/export.ts` — now exported and testable.
- Added 18 unit tests in `tests/unit/export.test.ts` covering:
  - Venue grouped format (Menu/Bar Package/Staffing/Equipment/Venue Rental/Production Fee/Tax)
  - Zero-row suppression
  - Staffing & Labor bucket splitting from Equipment & Staffing section
  - Full copy-text format with real numbers
  - AV type rows
  - `fmtAmt` formatting and rounding
- `ExportButtons.tsx` now imports from the utility — no behavior change, just testability.

### 2. File attachments (Supabase Storage)
- **Migration** `supabase/migrations/006_estimate_attachments.sql`:
  - Creates `estimate-attachments` storage bucket (private, 10MB limit, PDF/PNG/JPG/JPEG)
  - Storage RLS policies (insert/select/delete for authenticated)
  - `estimate_attachments` table (id, estimate_id, file_name, storage_path, file_size, mime_type, uploaded_by, created_at) with RLS
- **Server actions** added to `src/app/(programs)/programs/[id]/estimates/actions.ts`:
  - `uploadAttachment(formData)` — validates, uploads to storage, inserts DB record, returns signed URL
  - `getAttachmentsForEstimate(estimateId)` — returns records with 1-hour signed URLs
  - `deleteAttachment(id, storagePath)` — removes from storage + DB
- **`AttachmentsPanel`** component (`src/components/estimates/AttachmentsPanel.tsx`):
  - Upload button (hidden file input, `accept=".pdf,.png,.jpg,.jpeg"`)
  - File list: name (clickable download link), size, date, delete button
  - Loading/uploading/error states
- Wired into all three builders (Venue, AV, Decor) below the Travel Expenses section.

## Current State
- 74 tests passing (24 travel + 32 pricing + 18 export)
- TypeScript: no errors
- Branch: `main` — 2 commits ahead of remote

## Known Issues / Next Steps
- **Migration must be applied**: Run `supabase db push` or apply `006_estimate_attachments.sql` in the Supabase dashboard before the attachments feature is live.
- **Pending remaining items from PRD**:
  - Validate against 3-5 real historical proposals
  - PDF/Canva client-facing export
  - Mobile polish
  - Role-based access enforcement in UI

-- Add missing UPDATE policy to estimate_attachments.
-- Migration 006 only created SELECT/INSERT/DELETE policies, so any UPDATE
-- (e.g. writing extracted_data after PDF extraction) was silently rejected by RLS.
CREATE POLICY "Authenticated users can update estimate attachments"
ON estimate_attachments FOR UPDATE TO authenticated USING (true);

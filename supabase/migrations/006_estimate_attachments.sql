-- ─── Storage bucket ──────────────────────────────────────────────────────────
-- Creates the estimate-attachments bucket if it doesn't already exist.
-- RLS for storage.objects is enforced by the policies below.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estimate-attachments',
  'estimate-attachments',
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload
CREATE POLICY "estimate_attachments_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'estimate-attachments');

-- Authenticated users can view
CREATE POLICY "estimate_attachments_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'estimate-attachments');

-- Authenticated users can delete their own uploads
CREATE POLICY "estimate_attachments_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'estimate-attachments');

-- ─── Attachment metadata table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS estimate_attachments (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id  UUID        NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  file_name    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  file_size    INTEGER     NOT NULL,
  mime_type    TEXT        NOT NULL,
  uploaded_by  UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE estimate_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read estimate attachments"
ON estimate_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert estimate attachments"
ON estimate_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete estimate attachments"
ON estimate_attachments FOR DELETE TO authenticated USING (true);

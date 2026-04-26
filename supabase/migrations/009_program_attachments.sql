-- Program-level attachments table.
-- Uses the existing estimate-attachments storage bucket under a programs/ prefix.
-- Storage RLS policies already cover the entire bucket, no new policies needed.

CREATE TABLE IF NOT EXISTS program_attachments (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id     UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  file_name      TEXT        NOT NULL,
  storage_path   TEXT        NOT NULL,
  file_size      INTEGER     NOT NULL,
  mime_type      TEXT        NOT NULL,
  uploaded_by    UUID        REFERENCES auth.users(id),
  extracted_data JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE program_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read program attachments"
ON program_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert program attachments"
ON program_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete program attachments"
ON program_attachments FOR DELETE TO authenticated USING (true);

-- QC Estimator — Migration 032
-- Program-level document storage: menus, contracts, BEOs, floor plans, etc.
-- Uses the existing 'estimate-attachments' bucket under a 'program-documents/' prefix.
-- Kept separate from program_attachments (which are PDFs for AI brief extraction).

CREATE TYPE document_category AS ENUM (
  'Menu',
  'Contract',
  'Invoice',
  'Floor Plan',
  'BEO',
  'Insurance',
  'Proposal',
  'Correspondence',
  'Other'
);

CREATE TABLE program_documents (
  id           UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id   UUID          NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  file_name    TEXT          NOT NULL,
  storage_path TEXT          NOT NULL,
  file_size    INTEGER       NOT NULL,
  mime_type    TEXT          NOT NULL,
  category     document_category NOT NULL DEFAULT 'Other',
  notes        TEXT,
  uploaded_by  UUID          REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX program_documents_program_id_idx ON program_documents(program_id);
CREATE INDEX program_documents_category_idx   ON program_documents(program_id, category);

ALTER TABLE program_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage program_documents"
  ON program_documents FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- QC Estimator — Migration 033
-- Onsite Brief Generator: stores generated/edited briefs per program.
-- content JSONB: section key → { content, isAiDraft, sourceHint, lastEditedAt }
-- section_owners JSONB: section key → team_member_id

CREATE TABLE program_briefs (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id      UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  content         JSONB       NOT NULL DEFAULT '{}',
  section_owners  JSONB       NOT NULL DEFAULT '{}',
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_edited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id)   -- one brief per program; regeneration overwrites
);

ALTER TABLE program_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage program_briefs"
  ON program_briefs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

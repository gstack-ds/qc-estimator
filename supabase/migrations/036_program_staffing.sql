-- Migration 036: Onsite staffing tracker table.

DO $$ BEGIN
  CREATE TYPE staffing_status AS ENUM ('needs_staffing', 'assigned', 'confirmed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS program_staffing (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID          NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  role        TEXT          NOT NULL,
  assigned_to INTEGER       REFERENCES team_members(id) ON DELETE SET NULL,
  status      staffing_status NOT NULL DEFAULT 'needs_staffing',
  notes       TEXT          NULL,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_staffing_program_id ON program_staffing(program_id);

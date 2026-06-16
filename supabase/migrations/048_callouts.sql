-- Migration 048: Callouts — shared issue-tracking + discussion log on estimates.
--
-- Ethos: raise an issue the moment you see it, discuss it (replies), resolve it, documented.
-- NOT task assignment, NOT approval. Added ALONGSIDE estimates.internal_notes — this migration
-- does NOT touch, migrate, or remove internal_notes (that is a separate, later, reviewed step).
--
-- Additive + idempotent only (IF NOT EXISTS, no drops). Safe to run once or re-run.
--
-- Leak-proof by design: these tables are never joined into RawEstimate / DeckContract /
-- ProposalDocument, so callout text can never reach a client deck or proposal.
--
-- People columns (created_by / owner / resolved_by / replies.author) reference team_members(id),
-- captured via UI selectors (v1 has no auth.users -> team_members mapping). ON DELETE SET NULL
-- so removing a team member never deletes the issue history.

CREATE TABLE IF NOT EXISTS callouts (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID         NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  event_id    UUID         REFERENCES events(id) ON DELETE SET NULL,
  program_id  UUID         NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  text        TEXT         NOT NULL,
  category    TEXT         NULL,                          -- single-select tag (see app constants)
  status      TEXT         NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by  INTEGER      REFERENCES team_members(id) ON DELETE SET NULL,
  owner       INTEGER      REFERENCES team_members(id) ON DELETE SET NULL,  -- defaults to estimate.assigned_to at raise time
  resolved_by INTEGER      REFERENCES team_members(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ  NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_callouts_estimate_id ON callouts(estimate_id);
CREATE INDEX IF NOT EXISTS idx_callouts_event_id    ON callouts(event_id);
CREATE INDEX IF NOT EXISTS idx_callouts_program_id  ON callouts(program_id);
CREATE INDEX IF NOT EXISTS idx_callouts_status      ON callouts(status);
CREATE INDEX IF NOT EXISTS idx_callouts_owner       ON callouts(owner);

CREATE TABLE IF NOT EXISTS callout_replies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  callout_id UUID        NOT NULL REFERENCES callouts(id) ON DELETE CASCADE,
  author     INTEGER     REFERENCES team_members(id) ON DELETE SET NULL,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_callout_replies_callout_id ON callout_replies(callout_id);

-- updated_at trigger uses the existing function update_updated_at() (migration 001).
-- DROP TRIGGER IF EXISTS keeps this idempotent without dropping any data.
DROP TRIGGER IF EXISTS trg_callouts_updated_at ON callouts;
CREATE TRIGGER trg_callouts_updated_at
  BEFORE UPDATE ON callouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: authenticated users can read + write (internal tool; same posture as other tables).
ALTER TABLE callouts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE callout_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "callouts_all" ON callouts;
CREATE POLICY "callouts_all" ON callouts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "callout_replies_all" ON callout_replies;
CREATE POLICY "callout_replies_all" ON callout_replies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 054_budget_share_responses.sql
-- Phase 3: CLIENT CAPTURE. A public, no-login page lets the client adjust selections (tier per
-- line, per-line guest count, per-category target, notes) and submit a version back.
--
-- SECURITY MODEL (non-negotiable):
-- - The client NEVER gets a Supabase client; there is NO public/anon policy on this table.
-- - The ONLY write path is the server Route Handler POST /api/budget/[token]/respond, which uses
--   the service-role key (bypassing RLS) and writes ONLY here, scoped to one share_id derived from
--   a validated token. selections + computed_total are validated/computed SERVER-SIDE against the
--   locked snapshot — never trusting any number the client sends.
-- - APPEND-ONLY: each submit is a new row. All versions are kept.

CREATE TABLE budget_share_responses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id        UUID        NOT NULL REFERENCES budget_shares(id) ON DELETE CASCADE,
  -- Validated client choices as snapshot line-ID references + the server-computed per-event
  -- breakdown. Never contains client-supplied prices/names/categories.
  selections      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Authoritative total, computed server-side from locked snapshot prices × validated selections.
  computed_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- The only free-form client input. Length-capped at write time; always rendered escaped.
  client_notes    TEXT,
  status          TEXT        NOT NULL DEFAULT 'submitted',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip              TEXT,
  user_agent      TEXT
);

CREATE INDEX budget_share_responses_share_idx ON budget_share_responses(share_id);

ALTER TABLE budget_share_responses ENABLE ROW LEVEL SECURITY;

-- Authenticated team reads responses in Alex's view. Writes come from the service-role Route
-- Handler (bypasses RLS). NO anon/public policy exists — the public browser has zero DB access.
CREATE POLICY "auth read budget_share_responses"
  ON budget_share_responses FOR SELECT TO authenticated USING (true);

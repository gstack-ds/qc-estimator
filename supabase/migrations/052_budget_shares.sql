-- 052_budget_shares.sql
-- Phase 2: shareable client budget link (VIEW-ONLY). A budget_shares row holds a CLIENT-SAFE
-- snapshot (built at generation from the same projection the in-app Preview uses) plus an
-- expiry + revoke kill switch. Only a HASH of the token is stored — a DB dump never yields a
-- live link. The public route reads this table SERVER-SIDE via the service-role key (bypassing
-- RLS); the browser never gets a Supabase client, so there is intentionally NO anon policy.

CREATE TABLE budget_shares (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_document_id  UUID        NOT NULL REFERENCES budget_documents(id) ON DELETE CASCADE,
  token_hash          TEXT        NOT NULL UNIQUE,   -- sha256(token); raw token never stored
  snapshot            JSONB       NOT NULL,          -- client-safe BudgetShareContract
  label               TEXT,
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  view_count          INTEGER     NOT NULL DEFAULT 0,
  last_viewed_at      TIMESTAMPTZ
);

CREATE INDEX budget_shares_doc_idx ON budget_shares(budget_document_id);

ALTER TABLE budget_shares ENABLE ROW LEVEL SECURITY;

-- Authenticated team creates / lists / revokes shares. The PUBLIC read path uses the
-- service-role client server-side and bypasses RLS — no anon/public policy exists by design.
CREATE POLICY "auth manage budget_shares"
  ON budget_shares FOR ALL TO authenticated USING (true) WITH CHECK (true);

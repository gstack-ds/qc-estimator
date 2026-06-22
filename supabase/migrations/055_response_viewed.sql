-- 055_response_viewed.sql
-- Phase 4 Part 1: in-app unread indicator for client budget responses.
-- A response is "new" (unread) until someone opens the program's Client responses panel.
-- Shared team pool — one viewed_at, not per-user. Unread = viewed_at IS NULL.
--
-- No authenticated UPDATE policy is added: consistent with migration 054 (this table is written
-- only by trusted server code via the service-role key, never by an RLS-governed client write).
-- markResponsesViewed() sets viewed_at with the service-role client, auth-gated + scoped in code.
-- The authenticated SELECT policy from 054 is all the read side (count + panel) needs.

ALTER TABLE budget_share_responses ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- Treat every pre-existing response as already seen, so the new indicator starts at zero and
-- only responses submitted AFTER this ships count as new.
UPDATE budget_share_responses SET viewed_at = now() WHERE viewed_at IS NULL;

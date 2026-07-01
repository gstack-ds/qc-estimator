-- 058_chat_usage.sql
-- Daily per-user usage counter for the in-app read-only chatbot. Enforces a HARD daily cap
-- server-side (protects the ~$50/mo ceiling). This is the ONLY persisted chatbot state — chat
-- history is ephemeral. Additive; manual-run in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS chat_usage (
  user_id    uuid NOT NULL,
  usage_date date NOT NULL,        -- team-timezone (ET) calendar date, computed app-side
  count      integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

-- Writes happen ONLY via the service-role client in /api/chat (never the browser). No RLS
-- policies → anon/authenticated have no access; service-role bypasses RLS.
ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

-- Atomic increment-and-check. Returns whether the request is allowed (strictly below cap) and the
-- resulting count. An at-cap request is REJECTED WITHOUT incrementing (rejected-pre-billed requests
-- never consume a slot). The single INSERT..ON CONFLICT statement serializes concurrent same-user
-- requests on the row, so there is no read-then-write race.
CREATE OR REPLACE FUNCTION increment_chat_usage(p_user uuid, p_date date, p_cap integer)
RETURNS TABLE(allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO chat_usage (user_id, usage_date, count, updated_at)
  VALUES (p_user, p_date, 1, now())
  ON CONFLICT (user_id, usage_date)
    DO UPDATE SET count = chat_usage.count + 1, updated_at = now()
    WHERE chat_usage.count < p_cap
  RETURNING count INTO new_count;

  IF new_count IS NOT NULL THEN
    -- Inserted (first request today) or incremented (was below cap).
    RETURN QUERY SELECT true, new_count;
  ELSE
    -- Conflict + WHERE blocked (already at cap): read current, reject WITHOUT incrementing.
    SELECT count INTO new_count FROM chat_usage WHERE user_id = p_user AND usage_date = p_date;
    RETURN QUERY SELECT false, new_count;
  END IF;
END;
$$;

-- Lock it down: only the service-role may execute (the route calls it server-side). Not exposed
-- to anon/authenticated as a PostgREST RPC.
REVOKE ALL ON FUNCTION increment_chat_usage(uuid, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_chat_usage(uuid, date, integer) TO service_role;

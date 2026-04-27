-- QC Estimator — Migration 014
-- Add Events layer between Programs and Estimates
-- event_id on estimates is nullable for backward compat; backfill links all existing estimates

-- ── Event type enum ───────────────────────────────────────────────────────────

CREATE TYPE event_type AS ENUM (
  'logistics',
  'general_session',
  'formal_dinner',
  'experiential',
  'excursion',
  'cocktail_reception',
  'dine_around',
  'breakfast',
  'lunch',
  'custom'
);

-- ── Events table ──────────────────────────────────────────────────────────────

CREATE TABLE events (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id   UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT 'Event',
  event_date   DATE,
  start_time   TIME WITHOUT TIME ZONE,
  end_time     TIME WITHOUT TIME ZONE,
  guest_count  INT         NOT NULL DEFAULT 0,
  event_type   event_type  NOT NULL DEFAULT 'general_session',
  description  TEXT,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage events"
  ON events FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Add event_id to estimates ─────────────────────────────────────────────────
-- ON DELETE SET NULL: deleting an event orphans its estimates rather than destroying them

ALTER TABLE estimates
  ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- ── Backfill ──────────────────────────────────────────────────────────────────
-- One default "Program Events" event per program that has at least one estimate.
-- Inherits the program's event_date and guest_count.
-- Then all unlinked estimates for that program are pointed at the new event.

WITH inserted_events AS (
  INSERT INTO events (program_id, name, event_date, guest_count, event_type, sort_order)
  SELECT
    p.id          AS program_id,
    'Program Events' AS name,
    p.event_date,
    p.guest_count,
    'general_session'::event_type,
    0             AS sort_order
  FROM programs p
  WHERE EXISTS (SELECT 1 FROM estimates e WHERE e.program_id = p.id)
  RETURNING id, program_id
)
UPDATE estimates e
SET    event_id = ie.id
FROM   inserted_events ie
WHERE  ie.program_id = e.program_id
  AND  e.event_id IS NULL;

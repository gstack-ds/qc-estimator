-- QC Estimator — Migration 015
-- Add Venues and Venue Spaces tables; link estimates to venues

-- ── Venues ───────────────────────────────────────────────────────────────────

CREATE TABLE venues (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT        NOT NULL,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  service_styles  TEXT[]      NOT NULL DEFAULT '{}',
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  website         TEXT,
  notes           TEXT,
  last_used_date  DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage venues"
  ON venues FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Venue Spaces ─────────────────────────────────────────────────────────────

CREATE TABLE venue_spaces (
  id                      UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id                UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name                    TEXT    NOT NULL,
  capacity_seated         INT,
  capacity_standing       INT,
  fb_minimum              NUMERIC(12,2) NOT NULL DEFAULT 0,
  room_fee                NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_charge_default  NUMERIC(6,4),
  gratuity_default        NUMERIC(6,4),
  admin_fee_default       NUMERIC(6,4),
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE venue_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage venue_spaces"
  ON venue_spaces FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Link estimates to venues ──────────────────────────────────────────────────

ALTER TABLE estimates
  ADD COLUMN venue_id       UUID REFERENCES venues(id) ON DELETE SET NULL,
  ADD COLUMN venue_space_id UUID REFERENCES venue_spaces(id) ON DELETE SET NULL;

-- ── Auto-seed: one venue per unique name from existing venue-type estimates ───
-- Skips names that are clearly generic (empty, 'Untitled').
-- venue_spaces not auto-created — planners can add spaces manually.

INSERT INTO venues (name, last_used_date)
SELECT DISTINCT ON (e.name)
  e.name,
  p.event_date::date
FROM estimates e
JOIN programs p ON p.id = e.program_id
WHERE e.type = 'venue'
  AND e.name IS NOT NULL
  AND e.name <> ''
  AND e.name <> 'Untitled'
ORDER BY e.name, p.event_date DESC NULLS LAST;

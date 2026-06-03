-- QC Estimator — Migration 031
-- Program-level travel line items.
-- Travel is now entered once per program (not repeated across estimates).
-- The estimate_trips table and its reference tables are preserved for audit purposes
-- but are no longer exposed in the UI.

-- ── Program-level travel items ────────────────────────────

CREATE TABLE program_travel_items (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id  UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  description TEXT        NOT NULL DEFAULT '',
  qty         NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE program_travel_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage program_travel_items"
  ON program_travel_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Include-travel toggle on programs ────────────────────

ALTER TABLE programs
  ADD COLUMN include_travel_in_production_fee BOOLEAN NOT NULL DEFAULT false;

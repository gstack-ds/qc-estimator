-- Tour catalog: reusable tour reference records.
-- Stored as JSONB so adding new TourDetails fields requires no schema change.

CREATE TABLE IF NOT EXISTS tour_catalog (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  tour_details JSONB      NOT NULL DEFAULT '{}',
  notes       TEXT        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tour_catalog_updated_at
  BEFORE UPDATE ON tour_catalog
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE tour_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tour_catalog"
  ON tour_catalog FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert tour_catalog"
  ON tour_catalog FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update tour_catalog"
  ON tour_catalog FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete tour_catalog"
  ON tour_catalog FOR DELETE USING (auth.role() = 'authenticated');

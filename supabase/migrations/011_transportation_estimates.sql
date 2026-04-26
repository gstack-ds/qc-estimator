-- Transportation estimate support:
-- Per-estimate vehicle rate card, daily schedule rows, and per-estimate commission

-- Per-estimate commission override (used by transportation, nullable for others)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS transport_commission NUMERIC;

-- ─── Vehicle Rate Card ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_vehicle_rates (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id  UUID        NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  vehicle_type TEXT        NOT NULL,
  hourly_rate  NUMERIC     NOT NULL DEFAULT 0,
  hour_minimum NUMERIC,
  sort_order   INTEGER     NOT NULL DEFAULT 0
);

ALTER TABLE transport_vehicle_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transport_vehicle_rates_select" ON transport_vehicle_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport_vehicle_rates_insert" ON transport_vehicle_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "transport_vehicle_rates_update" ON transport_vehicle_rates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "transport_vehicle_rates_delete" ON transport_vehicle_rates FOR DELETE TO authenticated USING (true);

-- ─── Daily Schedule Rows ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_schedule_rows (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id     UUID        NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  service_date    DATE,
  vehicle_rate_id UUID        REFERENCES transport_vehicle_rates(id) ON DELETE SET NULL,
  service_type    TEXT        NOT NULL DEFAULT 'hourly',
  start_time      TEXT,
  end_time        TEXT,
  qty             INTEGER     NOT NULL DEFAULT 1,
  our_cost        NUMERIC     NOT NULL DEFAULT 0,
  client_cost     NUMERIC     NOT NULL DEFAULT 0,
  notes           TEXT,
  sort_order      INTEGER     NOT NULL DEFAULT 0
);

ALTER TABLE transport_schedule_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transport_schedule_rows_select" ON transport_schedule_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport_schedule_rows_insert" ON transport_schedule_rows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "transport_schedule_rows_update" ON transport_schedule_rows FOR UPDATE TO authenticated USING (true);
CREATE POLICY "transport_schedule_rows_delete" ON transport_schedule_rows FOR DELETE TO authenticated USING (true);

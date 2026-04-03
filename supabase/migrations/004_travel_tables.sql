-- Migration 004: Travel reference tables and estimate trips

-- ─── Drive Routes ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drive_routes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE drive_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drive_routes_auth" ON drive_routes FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Train Routes ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS train_routes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  low_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,
  high_cost  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE train_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "train_routes_auth" ON train_routes FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Flight Types ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flight_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name  TEXT NOT NULL,
  low_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,
  high_cost  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE flight_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flight_types_auth" ON flight_types FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Hotel Rates ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hotel_rates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market     TEXT NOT NULL,
  low_rate   NUMERIC(10,2) NOT NULL DEFAULT 0,
  high_rate  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hotel_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hotel_rates_auth" ON hotel_rates FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Per Diem Rates ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS per_diem_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_type TEXT NOT NULL,
  full_day    NUMERIC(8,2) NOT NULL DEFAULT 0,
  half_day    NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE per_diem_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "per_diem_rates_auth" ON per_diem_rates FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Vehicle Rates ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_rates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market            TEXT NOT NULL,
  sedan_hourly      NUMERIC(8,2) NOT NULL DEFAULT 0,
  sedan_airport     NUMERIC(8,2) NOT NULL DEFAULT 0,
  suv_hourly        NUMERIC(8,2) NOT NULL DEFAULT 0,
  suv_airport       NUMERIC(8,2) NOT NULL DEFAULT 0,
  sprinter_hourly   NUMERIC(8,2) NOT NULL DEFAULT 0,
  sprinter_airport  NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vehicle_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_rates_auth" ON vehicle_rates FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Estimate Trips ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS estimate_trips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id         UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  trip_number         INTEGER NOT NULL CHECK (trip_number BETWEEN 1 AND 3),
  label               TEXT NOT NULL DEFAULT '',
  travel_type         TEXT NOT NULL DEFAULT 'None' CHECK (travel_type IN ('Drive', 'Train', 'Flight', 'None')),
  drive_route_id      UUID REFERENCES drive_routes(id),
  train_route_id      UUID REFERENCES train_routes(id),
  flight_type_id      UUID REFERENCES flight_types(id),
  last_minute_buffer  BOOLEAN NOT NULL DEFAULT false,
  staff_count         INTEGER NOT NULL DEFAULT 1,
  nights              INTEGER NOT NULL DEFAULT 0,
  hotel_rate_id       UUID REFERENCES hotel_rates(id),
  hotel_budget        TEXT NOT NULL DEFAULT 'Low' CHECK (hotel_budget IN ('Low', 'High')),
  per_diem_rate_id    UUID REFERENCES per_diem_rates(id),
  vehicle_rate_id     UUID REFERENCES vehicle_rates(id),
  vehicle_type        TEXT NOT NULL DEFAULT 'None' CHECK (vehicle_type IN ('Sedan', 'SUV', 'Sprinter', 'None')),
  vehicle_service     TEXT NOT NULL DEFAULT 'Airport Transfer' CHECK (vehicle_service IN ('Airport Transfer', 'Hourly')),
  vehicle_hours       NUMERIC(5,1) NOT NULL DEFAULT 0,
  custom_vehicle_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(estimate_id, trip_number)
);

ALTER TABLE estimate_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estimate_trips_auth" ON estimate_trips FOR ALL USING (auth.uid() IS NOT NULL);

-- updated_at triggers (reuses function from migration 001)
CREATE TRIGGER drive_routes_updated_at BEFORE UPDATE ON drive_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER train_routes_updated_at BEFORE UPDATE ON train_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER flight_types_updated_at BEFORE UPDATE ON flight_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER hotel_rates_updated_at BEFORE UPDATE ON hotel_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER per_diem_rates_updated_at BEFORE UPDATE ON per_diem_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER vehicle_rates_updated_at BEFORE UPDATE ON vehicle_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER estimate_trips_updated_at BEFORE UPDATE ON estimate_trips FOR EACH ROW EXECUTE FUNCTION update_updated_at();

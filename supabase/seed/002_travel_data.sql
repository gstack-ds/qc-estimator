-- Seed: Travel reference data (from QC_Estimate_Template_2026.xlsx)

-- ─── Drive Routes ─────────────────────────────────────────
INSERT INTO drive_routes (route_name, cost) VALUES
  ('DC to Richmond VA',      205.00),
  ('Charlotte to Raleigh NC', 230.00),
  ('Charlotte to Charleston SC', 180.00),
  ('Charlotte to Asheville NC', 120.00),
  ('DC to Philadelphia',     120.00),
  ('Philadelphia to NYC',    100.00),
  ('Charlotte to Atlanta',   275.00),
  ('DC to Charlotte',        450.00),
  ('Atlanta to Charlotte',   275.00);

-- ─── Train Routes ─────────────────────────────────────────
INSERT INTO train_routes (route_name, low_cost, high_cost) VALUES
  ('DC to NYC',             80.00, 200.00),
  ('Philadelphia to NYC',   40.00, 120.00),
  ('Charlotte to DC',      150.00, 300.00);

-- ─── Flight Types ─────────────────────────────────────────
-- Last minute buffer: +$150/person (applied in calculation engine)
INSERT INTO flight_types (type_name, low_cost, high_cost) VALUES
  ('Short Haul',              350.00,  550.00),
  ('Medium Haul',             450.00,  750.00),
  ('Major Market to NYC',     400.00,  650.00);

-- ─── Hotel Rates (per night) ──────────────────────────────
INSERT INTO hotel_rates (market, low_rate, high_rate) VALUES
  ('NYC',            450.00, 650.00),
  ('DC',             350.00, 550.00),
  ('Philadelphia',   250.00, 400.00),
  ('Charlotte',      175.00, 275.00),
  ('Atlanta',        200.00, 350.00),
  ('Raleigh NC',     150.00, 250.00),
  ('Charleston SC',  175.00, 300.00),
  ('Asheville NC',   150.00, 250.00),
  ('Richmond VA',    150.00, 250.00);

-- ─── Per Diem Rates ───────────────────────────────────────
INSERT INTO per_diem_rates (market_type, full_day, half_day) VALUES
  ('Standard',  68.00, 34.00),
  ('NYC',       92.00, 46.00);

-- ─── Vehicle Rates ────────────────────────────────────────
INSERT INTO vehicle_rates (market, sedan_hourly, sedan_airport, suv_hourly, suv_airport, sprinter_hourly, sprinter_airport) VALUES
  ('NYC',           125.00, 175.00, 150.00, 200.00, 200.00, 275.00),
  ('DC',            110.00, 150.00, 135.00, 175.00, 185.00, 250.00),
  ('Philadelphia',   95.00, 130.00, 120.00, 155.00, 165.00, 220.00),
  ('Charlotte',      85.00, 115.00, 105.00, 140.00, 150.00, 195.00),
  ('Atlanta',        90.00, 120.00, 110.00, 145.00, 155.00, 205.00),
  ('Raleigh NC',     80.00, 110.00,  99.00, 130.00, 140.00, 185.00),
  ('Charleston SC',  85.00, 115.00, 105.00, 140.00, 150.00, 195.00),
  ('Asheville NC',   80.00, 110.00,  99.00, 130.00, 140.00, 185.00),
  ('Richmond VA',    80.00, 110.00,  99.00, 130.00, 140.00, 185.00),
  ('Virginia Secondary', 75.00, 100.00, 95.00, 125.00, 135.00, 175.00);

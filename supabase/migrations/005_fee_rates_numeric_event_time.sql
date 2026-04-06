-- QC Estimator — Migration 005
-- 1. Convert fee rate columns from TEXT to NUMERIC (store as decimal, e.g. 0.20 = 20%)
-- 2. Add event_start_time and event_end_time to programs (replacing free-text event_time)

-- ─── programs: fee defaults TEXT → NUMERIC ───────────────────────────────────

ALTER TABLE programs
  ALTER COLUMN service_charge_default TYPE NUMERIC(6,4) USING (
    CASE service_charge_default
      WHEN '20%'   THEN 0.2000
      WHEN '21.5%' THEN 0.2150
      WHEN '5%'    THEN 0.0500
      WHEN 'None'  THEN 0.0000
      ELSE 0.2000
    END
  ),
  ALTER COLUMN gratuity_default TYPE NUMERIC(6,4) USING (
    CASE gratuity_default
      WHEN '20%'  THEN 0.2000
      WHEN 'None' THEN 0.0000
      ELSE 0.2000
    END
  ),
  ALTER COLUMN admin_fee_default TYPE NUMERIC(6,4) USING (
    CASE admin_fee_default
      WHEN '5%'   THEN 0.0500
      WHEN 'None' THEN 0.0000
      ELSE 0.0500
    END
  );

ALTER TABLE programs
  ALTER COLUMN service_charge_default SET DEFAULT 0.2000,
  ALTER COLUMN gratuity_default       SET DEFAULT 0.2000,
  ALTER COLUMN admin_fee_default      SET DEFAULT 0.0500;

-- ─── estimates: fee overrides TEXT → NUMERIC ─────────────────────────────────

ALTER TABLE estimates
  ALTER COLUMN service_charge_override TYPE NUMERIC(6,4) USING (
    CASE service_charge_override
      WHEN '20%'   THEN 0.2000
      WHEN '21.5%' THEN 0.2150
      WHEN '5%'    THEN 0.0500
      WHEN 'None'  THEN 0.0000
      ELSE NULL
    END
  ),
  ALTER COLUMN gratuity_override TYPE NUMERIC(6,4) USING (
    CASE gratuity_override
      WHEN '20%'  THEN 0.2000
      WHEN 'None' THEN 0.0000
      ELSE NULL
    END
  ),
  ALTER COLUMN admin_fee_override TYPE NUMERIC(6,4) USING (
    CASE admin_fee_override
      WHEN '5%'   THEN 0.0500
      WHEN 'None' THEN 0.0000
      ELSE NULL
    END
  );

-- ─── programs: split event_time into start/end ───────────────────────────────

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS event_start_time TEXT,
  ADD COLUMN IF NOT EXISTS event_end_time   TEXT;

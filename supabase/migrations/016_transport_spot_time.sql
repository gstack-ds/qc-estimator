-- Add spot_time column to transport_schedule_rows
-- Spot time is when the vehicle arrives before the scheduled pickup

ALTER TABLE transport_schedule_rows
  ADD COLUMN IF NOT EXISTS spot_time TIME DEFAULT NULL;

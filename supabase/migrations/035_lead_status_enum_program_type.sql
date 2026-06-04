-- Migration 035: Add tracking_on_hold and negotiations to lead_status enum,
-- remap existing data, add program_type to programs.

-- Step 1: Add new enum values (IF NOT EXISTS guards against re-running)
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'tracking_on_hold';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'negotiations';

-- Step 2: Remap lead data
-- halted (old "paused") → tracking_on_hold
-- planning / planning_not_started → under_contract (signed deals already being worked)
UPDATE leads SET status = 'tracking_on_hold' WHERE status = 'halted';
UPDATE leads SET status = 'under_contract'   WHERE status IN ('planning', 'planning_not_started');

-- Step 3: Add program_type to programs (nullable text)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_type TEXT NULL;

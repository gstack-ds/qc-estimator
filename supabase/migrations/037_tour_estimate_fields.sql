-- Migration 037: Add 'tour' estimate type, tour_details JSONB, default_pricing_mode on programs.

-- Step 1: Add 'tour' to estimate_type enum
ALTER TYPE estimate_type ADD VALUE IF NOT EXISTS 'tour';

-- Step 2: Add tour_details JSONB column to estimates
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS tour_details JSONB NULL;

-- Step 3: Add default_pricing_mode to programs (per_person or flat)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS default_pricing_mode TEXT NOT NULL DEFAULT 'per_person';

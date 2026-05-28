-- Migration 026: Add slide_copy_data JSONB column to estimates
-- Stores all Slide Copy module state (venue inputs, inclusions, menu selections)

ALTER TABLE estimates ADD COLUMN slide_copy_data JSONB;

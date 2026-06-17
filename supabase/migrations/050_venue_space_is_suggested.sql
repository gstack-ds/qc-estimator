-- 050_venue_space_is_suggested.sql
-- Venue card Phase 1: mark which space to pitch on a venue profile card.
-- Additive only — existing rows default to false. Display/planning flag; not fed to the pricing engine.

ALTER TABLE venue_spaces
  ADD COLUMN IF NOT EXISTS is_suggested BOOLEAN NOT NULL DEFAULT false;

-- Migration 027: Line item thumbnail images
-- Adds optional thumbnail fields to estimate_line_items.
-- thumbnail_url: public URL in Supabase Storage (uploaded photo)
-- thumbnail_icon: Lucide icon name for the built-in icon picker

ALTER TABLE estimate_line_items
  ADD COLUMN IF NOT EXISTS thumbnail_url  text,
  ADD COLUMN IF NOT EXISTS thumbnail_icon text;

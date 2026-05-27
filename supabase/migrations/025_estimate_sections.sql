-- Migration 025: estimate_sections
-- Creates a per-estimate section definition table that replaces hard-coded
-- section string routing. Each estimate owns its own section rows.
-- Backfills section_id FK on all existing estimate_line_items.

-- ─── 1. Create estimate_sections table ──────────────────────────────────────

CREATE TABLE estimate_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_bucket TEXT NOT NULL CHECK (tax_bucket IN ('fb', 'equipment', 'venue', 'staffing')),
  markup_pct NUMERIC(6, 4) NOT NULL DEFAULT 0.65,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_built_in BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_estimate_sections_estimate_id ON estimate_sections(estimate_id);

-- RLS
ALTER TABLE estimate_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read estimate_sections"
  ON estimate_sections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert estimate_sections"
  ON estimate_sections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update estimate_sections"
  ON estimate_sections FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can delete estimate_sections"
  ON estimate_sections FOR DELETE
  TO authenticated
  USING (true);

-- ─── 2. Add section_id FK to estimate_line_items ────────────────────────────

ALTER TABLE estimate_line_items
  ADD COLUMN section_id UUID REFERENCES estimate_sections(id) ON DELETE SET NULL;

-- ─── 3. Seed default sections for all existing estimates ────────────────────
-- Uses the estimate type to determine which sections to create.
-- This matches the default sections in the spec.

-- Venue estimates
INSERT INTO estimate_sections (estimate_id, name, tax_bucket, markup_pct, sort_order, is_built_in)
SELECT
  e.id,
  s.name,
  s.tax_bucket,
  s.markup_pct,
  s.sort_order,
  true
FROM estimates e
CROSS JOIN (VALUES
  ('F&B', 'fb', 0.55, 0),
  ('Equipment & Staffing', 'equipment', 0.65, 1),
  ('Venue Fees', 'venue', 0.60, 2),
  ('Non-Taxable Staffing', 'staffing', 0.90, 3)
) AS s(name, tax_bucket, markup_pct, sort_order)
WHERE e.estimate_type = 'venue';

-- AV estimates
INSERT INTO estimate_sections (estimate_id, name, tax_bucket, markup_pct, sort_order, is_built_in)
SELECT
  e.id,
  s.name,
  s.tax_bucket,
  s.markup_pct,
  s.sort_order,
  true
FROM estimates e
CROSS JOIN (VALUES
  ('AV & Production', 'equipment', 0.65, 0),
  ('Non-Taxable Staffing', 'staffing', 0.90, 1)
) AS s(name, tax_bucket, markup_pct, sort_order)
WHERE e.estimate_type = 'av';

-- Decor estimates
INSERT INTO estimate_sections (estimate_id, name, tax_bucket, markup_pct, sort_order, is_built_in)
SELECT
  e.id,
  s.name,
  s.tax_bucket,
  s.markup_pct,
  s.sort_order,
  true
FROM estimates e
CROSS JOIN (VALUES
  ('Florals - Taxable', 'equipment', 0.85, 0),
  ('Florals - Non-Taxable', 'staffing', 0.85, 1),
  ('Rentals - Seating', 'equipment', 0.85, 2),
  ('Rentals - Lounge', 'equipment', 0.85, 3),
  ('Rentals - Tables', 'equipment', 0.85, 4),
  ('Rentals - Rugs & Accessories', 'equipment', 0.85, 5),
  ('Rentals - Non-Taxable', 'staffing', 0.85, 6),
  ('Non-Taxable Staffing', 'staffing', 0.90, 7)
) AS s(name, tax_bucket, markup_pct, sort_order)
WHERE e.estimate_type = 'decor';

-- Transportation: no sections (transportation uses its own builder, no line item sections)
-- Skip transportation estimates.

-- ─── 4. Backfill section_id on existing line items ──────────────────────────
-- Match each line item's section text to the newly seeded estimate_sections row.

UPDATE estimate_line_items eli
SET section_id = es.id
FROM estimate_sections es
WHERE es.estimate_id = eli.estimate_id
  AND es.name = eli.section
  AND eli.section_id IS NULL;

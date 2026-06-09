-- Migration 043: markets reference table
-- Replaces free-text market field on vendors with a seeded reference list.
-- Seed from distinct non-null values already in venues.market.

CREATE TABLE markets (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed from existing data
INSERT INTO markets (name)
SELECT DISTINCT market
FROM venues
WHERE market IS NOT NULL AND market <> ''
ORDER BY market;

-- RLS: readable by all authenticated users, writable by admins
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "markets_read" ON markets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "markets_insert" ON markets
  FOR INSERT TO authenticated WITH CHECK (true);

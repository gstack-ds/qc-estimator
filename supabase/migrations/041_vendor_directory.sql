-- 041_vendor_directory.sql
-- Extend the venues table into a unified vendor directory.
-- Preserves all existing FKs (estimates.venue_id, estimates.venue_space_id) and data.
-- Table stays named "venues" — no FK rewrites needed.

-- ── Vendor type enum ──────────────────────────────────────────────────────────

CREATE TYPE vendor_type AS ENUM (
  'venue', 'restaurant', 'tour', 'transportation', 'entertainment', 'decor'
);

-- ── Extend venues ─────────────────────────────────────────────────────────────

ALTER TABLE venues
  ADD COLUMN vendor_type    vendor_type NOT NULL DEFAULT 'venue',
  ADD COLUMN contact_title  TEXT,
  ADD COLUMN email_signature TEXT,
  ADD COLUMN market         TEXT;

-- ── Re-tag known restaurants ──────────────────────────────────────────────────
-- Patterns matched (case-insensitive): 5church, saints+council, beau beau,
-- flour+barrel. Gary should review and re-tag any remaining restaurants manually.

UPDATE venues SET vendor_type = 'restaurant'
WHERE lower(name) LIKE '%5church%'
   OR (lower(name) LIKE '%saints%' AND lower(name) LIKE '%council%')
   OR lower(name) LIKE '%beau beau%'
   OR (lower(name) LIKE '%flour%' AND lower(name) LIKE '%barrel%');

-- Row count report (informational — review output after running):
-- SELECT vendor_type, count(*) FROM venues GROUP BY vendor_type ORDER BY vendor_type;

-- ── Space privacy tag ─────────────────────────────────────────────────────────

CREATE TYPE space_privacy_tag AS ENUM ('private', 'semi_private', 'main_dining');

ALTER TABLE venue_spaces
  ADD COLUMN privacy_tag space_privacy_tag;

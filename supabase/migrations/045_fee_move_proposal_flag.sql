-- Move service/gratuity/admin fee defaults from venue_spaces → venues.
-- These are vendor-level rates, not per-space, and belong on the parent vendor row.
-- Also adds included_in_proposal flag to estimates.

-- 1. Add fee columns to venues
ALTER TABLE venues
  ADD COLUMN service_charge_default numeric(5,4),
  ADD COLUMN gratuity_default       numeric(5,4),
  ADD COLUMN admin_fee_default      numeric(5,4);

-- 2. Backfill: copy from the first space (by created_at) that has any non-null fee value
UPDATE venues v
SET
  service_charge_default = s.service_charge_default,
  gratuity_default       = s.gratuity_default,
  admin_fee_default      = s.admin_fee_default
FROM (
  SELECT DISTINCT ON (venue_id)
    venue_id,
    service_charge_default,
    gratuity_default,
    admin_fee_default
  FROM venue_spaces
  WHERE service_charge_default IS NOT NULL
     OR gratuity_default        IS NOT NULL
     OR admin_fee_default        IS NOT NULL
  ORDER BY venue_id, created_at ASC
) s
WHERE v.id = s.venue_id;

-- 3. Drop fee columns from venue_spaces
ALTER TABLE venue_spaces
  DROP COLUMN service_charge_default,
  DROP COLUMN gratuity_default,
  DROP COLUMN admin_fee_default;

-- 4. Add included_in_proposal to estimates (default true = all existing estimates included)
ALTER TABLE estimates
  ADD COLUMN included_in_proposal boolean NOT NULL DEFAULT true;

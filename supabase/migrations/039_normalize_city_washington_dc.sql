-- One-time backfill: normalize DC city variants to canonical 'Washington, DC'.
-- Going forward, normalizeCity() in src/lib/venues/normalize.ts guards all write paths
-- (venues/actions.ts, leads/actions.ts, scanner/writer.ts).
--
-- Variants matched (case-insensitive, after trim + whitespace collapse):
--   'washington', 'washington dc', 'washington, dc', 'washington d.c.', 'washington, d.c.'
-- Rows already storing 'Washington, DC' are excluded from the update.

UPDATE venues
SET    city       = 'Washington, DC',
       updated_at = now()
WHERE  city IS NOT NULL
  AND  city <> 'Washington, DC'
  AND  lower(regexp_replace(trim(city), '\s+', ' ', 'g')) IN (
         'washington',
         'washington dc',
         'washington, dc',
         'washington d.c.',
         'washington, d.c.'
       );

-- leads.city stores the same value from email parsing / inline editing.
-- updated_at is handled automatically by the trg_leads_updated_at trigger.
UPDATE leads
SET    city = 'Washington, DC'
WHERE  city IS NOT NULL
  AND  city <> 'Washington, DC'
  AND  lower(regexp_replace(trim(city), '\s+', ' ', 'g')) IN (
         'washington',
         'washington dc',
         'washington, dc',
         'washington d.c.',
         'washington, d.c.'
       );

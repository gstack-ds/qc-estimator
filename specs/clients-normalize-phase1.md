# Clients Normalize — Phase 1 (additive foundation)

## Goal
Stand up a shared `clients` table + `client_id` references on leads and programs, with existing client
data migrated and deduped into it. Foundation for connecting leads↔programs via a shared client.

## HARD CONSTRAINT — purely additive
Creates new structure and COPIES data in. Does **not** drop/modify any existing column or value on
leads or programs. No read path, write path, or `createProgramFromLead` changes this phase. The app
behaves identically — nothing references `client_id` yet.

## What this phase adds (migration 057 only — no app code changes)
- `clients` table: client-level identity (client_name, company_name, end_client), **contacts**
  (contact_name/email/role, client_contact_name — dropped entirely today), third-party fields,
  commission (client_commission, gdp_commission_rate, gdp_commission, extra_commission),
  commission_notes, billing_notes, returning_client. (Event-level + lead-intake/pipeline fields are
  intentionally excluded.)
- nullable `client_id UUID REFERENCES clients(id) ON DELETE SET NULL` on **leads** and **programs**
  (+ indexes).
- One-time data migration (DO block) that dedupes and backfills.

## Dedupe rule (the critical part)
A program linked to a lead (`programs.lead_id`) is the SAME client → **one shared client row**, and
both `programs.client_id` and `leads.client_id` point to it. Standalone programs and unconverted leads
each get their own client. Field precedence for a pair: program wins shared identity/commission
(COALESCE program → lead); contacts + lead-only commission/notes come from the lead.

The reference logic is unit-tested in `scripts/migrateClients.ts` (the SQL DO block is the
source of truth; the TS mirrors it so the dedupe/precedence rules have test coverage — vitest can't
run Postgres). Tests: `tests/unit/migrateClients.test.ts` (9).

## Migration number
**057** — 056 is the highest repo file (EEG); 053 remains the known manual gap. Run in Supabase first.

## Post-migration verification (run on preview after applying 057)
```sql
-- 1. Every lead and program backfilled (both expect 0)
SELECT count(*) FROM leads    WHERE client_id IS NULL;
SELECT count(*) FROM programs WHERE client_id IS NULL;

-- 2. Every lead↔program pair shares the SAME client (expect 0 mismatches)
SELECT count(*) FROM programs pr JOIN leads l ON l.id = pr.lead_id
WHERE pr.client_id IS DISTINCT FROM l.client_id;

-- 3. Client count reconciles: pairs + standalone programs + unconverted leads
SELECT
  (SELECT count(*) FROM programs WHERE lead_id IS NOT NULL) AS pairs,
  (SELECT count(*) FROM programs WHERE lead_id IS NULL)     AS standalone_programs,
  (SELECT count(*) FROM leads l WHERE NOT EXISTS (SELECT 1 FROM programs p WHERE p.lead_id = l.id)) AS lone_leads,
  (SELECT count(*) FROM clients) AS clients_total;  -- clients_total = pairs + standalone_programs + lone_leads

-- 4. Spot-check migrated data (contacts only exist via the lead side)
SELECT l.client_name, c.client_name, c.contact_email, c.client_commission
FROM leads l JOIN clients c ON c.id = l.client_id LIMIT 10;
```

## Behavioral check (preview)
The app must work exactly as before — leads list/board, programs, conversion, exports all unchanged
(they still read/write the original columns; `client_id` is dormant). No existing column or value touched.

## Out of scope (later phases)
Reading/writing through `client_id`, syncing client-level edits, changing `createProgramFromLead`,
deprecating the duplicated columns. None of that happens here.

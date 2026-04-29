# Checkpoint — 2026-04-29

## What Was Done
Built the Leads Pipeline Phase 1a + 1b on branch `feat/leads-pipeline`.

**Phase 1a — Migration `017_add_leads.sql`:**
- `lead_status` ENUM: `new_lead`, `proposal`, `under_contract`, `archived`
- `leads` table with all 30+ GDP fields, system/scanner metadata fields, RLS policies, updated_at trigger
- `programs.lead_id` nullable UUID FK referencing leads

**Phase 1b — UI:**
- `DbLead` interface + `getLeads`, `getLead`, `getLeadCounts`, `getProgramForLead` queries
- `src/app/(programs)/leads/actions.ts`: `createLead`, `updateLead`, `deleteLead`, `archiveLead`, `createProgramFromLead`
- `LeadStatusBadge`, `LeadsList` (sortable/filterable + Add Lead modal), `LeadDetail` (all fields inline-editable)
- `/leads` list page and `/leads/[id]` detail page inside `(programs)` route group
- "Leads" added as first nav link in header
- `createProgramFromLead`: pre-fills program from lead, moves lead to Proposal, redirects to new program

## Current State
- All 74 tests passing, TypeScript clean
- Branch: `feat/leads-pipeline` (not merged to main)
- **Migration 017 must be run** in Supabase SQL editor before the Leads UI works

## Known Issues / Gaps
- `assigned_to` is plain text (name) for Phase 1 — becomes a UUID FK to auth.users in Phase 2 with the scanner
- `createProgramFromLead` does a fuzzy city → location_id lookup; leaves null if no match
- Migration 016 (transport spot_time) should also be run if not already done

## Next Steps (from PRD build order)
1. Run migration `017_add_leads.sql` in Supabase SQL editor
2. Merge `feat/leads-pipeline` to main
3. **Phase 1c** — Lead-to-program link visible from the program view (programs/[id] shows a "← Source Lead" link when `lead_id` is set)
4. **Phase 1d** — Region router config (`src/lib/scanner/router.ts`) — maps region strings to owner names
5. **Phase 2a–2f** — Gmail scanner, Claude parser, Supabase writer, notifications, PM2 deployment

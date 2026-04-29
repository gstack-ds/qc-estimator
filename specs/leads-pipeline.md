# Spec: Leads Pipeline — Phase 1a + 1b

## Goal
Add a Leads section to qc-estimator. Team can manually enter and view leads immediately. Scanner (Phase 2) drops data into the same table.

## Phase 1a — Migration
- `supabase/migrations/017_add_leads.sql`
- Creates `lead_status` ENUM: new_lead, proposal, under_contract, archived
- Creates `leads` table with all GDP fields + system fields + RLS
- `assigned_to` is text (name: Alex / Lindsey / Lydia / null) — no FK to auth.users yet; that's a Phase 2 concern tied to the scanner
- Adds `lead_id` nullable UUID FK from `programs` to `leads`
- updated_at trigger

## Phase 1b — UI

### New files
- `supabase/migrations/017_add_leads.sql`
- `src/lib/supabase/queries.ts` — DbLead interface, getLeads, getLead
- `src/app/(programs)/leads/actions.ts` — createLead, updateLead, deleteLead, createProgramFromLead
- `src/app/(programs)/leads/page.tsx` — list page (Server Component)
- `src/app/(programs)/leads/[id]/page.tsx` — detail page (Server Component wrapper)
- `src/components/leads/LeadStatusBadge.tsx`
- `src/components/leads/LeadsList.tsx` — client component with sorting, filters, add modal
- `src/components/leads/LeadDetail.tsx` — client component with inline editing
- Update `src/app/(programs)/layout.tsx` — add Leads nav link

### Key decisions
- Leads live in `(programs)` route group → shares the charcoal nav header layout
- URL: `/leads` (list), `/leads/[id]` (detail)
- Status filter tabs at top with count badges
- "Add Lead" opens an inline panel (no separate page)
- "Create Program" action: creates program with lead fields pre-filled, sets lead.status = 'proposal', redirects to new program
- Programs page links back to source lead when lead_id is set (Phase 1c — skip for now, just build the core)

## Done looks like
- `/leads` page loads with empty state (no data until scanner or manual entry)
- "Add Lead" form creates a lead that appears in the table
- Clicking a lead row navigates to `/leads/[id]`
- Detail page shows all fields, all inline-editable
- Status badge updates on change
- "Create Program" button works end-to-end
- All 74 existing tests still pass

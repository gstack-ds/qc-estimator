# Callouts v1 — Spec / Plan

## Goal
Shared issue-tracking + discussion log on estimates. Ethos: raise → discuss → resolve, documented.
NOT task assignment, NOT approval. Added ALONGSIDE `internal_notes` (no migration/removal of it in v1).

## Key decisions (review these first)
1. **`created_by` / `owner` / `resolved_by` / reply `author` are explicit team-member selectors, NOT
   auto-derived from the auth session.** Reason: `team_members` has no link to `auth.users`
   (email column unpopulated; other features store `created_by` as an auth UUID). Truly automatic
   capture needs a later step: populate `team_members.email` + a `getCurrentTeamMember()` helper
   that maps `auth.getUser().email` → `team_members.id`. v1 defaults the author/owner dropdowns to
   the estimate's `assigned_to` to minimize friction.
2. **Added an `owner` column** (not in the #1 column list but required by "default the owner" and
   "filter by owner"). Defaults to the estimate's `assigned_to` at raise time; editable; filterable.
3. **Callouts are estimate-scoped** (`estimate_id` NOT NULL); `event_id` + `program_id` are
   denormalized (nullable event_id) for filtering, linking, and event-header aggregate counts.
4. **status = `open` | `resolved`** (TEXT + CHECK, per spec — no `in_progress`).
5. **tag/category = TEXT** (not enum, for future categories), UI single-select from 5 seed values.

## Leak-proof (non-negotiable)
Callouts live in their own tables, never joined into `RawEstimate` / `DeckContract` /
`ProposalDocument`. Safe by construction (those types never declare callout fields). Tests prove a
callout + reply produce contract JSON + rendered deck HTML with zero trace.

## Files
- Migration: `supabase/migrations/048_callouts.sql` (run by Gary; idempotent, additive)
- `src/lib/callouts/constants.ts` — server-free: status/tags, labels, colors, pure helpers
- `src/lib/supabase/queries.ts` — DbCallout/DbCalloutReply + queries (estimate/program/all/count)
- `src/app/(programs)/callouts/actions.ts` — raise / reply / resolve / reopen
- `src/app/(programs)/callouts/page.tsx` + `src/components/callouts/CalloutsView.tsx` — dedicated page
- `src/components/callouts/CalloutThread.tsx` + `CalloutThreadModal.tsx` + `CalloutBadge.tsx`
- Nav: `layout.tsx` (+ open-count fetch) → `NavLinks.tsx` / `MobileNav.tsx` (badge support)
- `EventsView.tsx` + program `page.tsx` — card badge + thread + event-header aggregate
- Tests: `tests/unit/callouts.test.ts` (pure helpers) + leak-proof block in `tests/unit/deck.test.ts`

## Done = full suite green, `next build` clean, @code-review + @qa run, branch only (no merge/deploy/prod migration).

# Checkpoint — 2026-04-27

## What Was Done
Added an Events layer between Programs and Estimates.

**Migration 014 (`supabase/migrations/014_events.sql`) — MUST RUN:**
- Creates `event_type` PostgreSQL ENUM (logistics, general_session, formal_dinner, experiential, excursion, cocktail_reception, dine_around, breakfast, lunch, custom)
- Creates `events` table (program_id FK, name, event_date, start_time, end_time, guest_count, event_type, description, sort_order)
- Adds `event_id` nullable FK to `estimates` (ON DELETE SET NULL)
- Backfill CTE: creates one "Program Events" default event per program that has estimates, links all existing estimates to it

**Code changes (feat/events-layer branch):**
- `queries.ts`: `DbEvent` interface, `getEventsForProgram()`, `event_id` added to `DbEstimate` and `ESTIMATE_FIELDS`
- `actions.ts`: `createEvent`, `updateEvent`, `deleteEvent`; `createEstimate` accepts optional `eventId` param
- `AddEstimateButton`: accepts optional `eventId` prop
- `AddEventButton`: new inline form component (name, date, start/end time, guest count, event type, description)
- `EventsView`: new client component — Total Budget banner, event cards with color-coded type badges, estimate mini-cards inside each event, Add Event form, Add Estimate per event, event delete, collapse/expand
- `programs/[id]/page.tsx`: fetches events alongside estimates, groups estimate cards by `event_id`, passes `EventRow[]` to `EventsView`

## Current State
- All 74 tests passing
- TypeScript clean
- Migration file written but **not yet run against Supabase** — must be applied before the UI will work
- Branch: `feat/events-layer` (not merged to main)

## Known Issues / Gaps
- **Migration must be run manually** in Supabase dashboard SQL editor (paste contents of 014_events.sql)
- **No edit UI for events** — users can add and delete events, but cannot edit fields after creation (follow-up)
- **Guest count is informational only** — event guest_count displays on the card header but does not feed into pricing engine (which still uses program-level guest_count)
- **Lowest/Best Margin badges** within an event compare across ALL estimate types in that event (not by type). May want to filter by type within EventCard if multi-type events are common.
- **Sort order for new events** is max(existing) + 1; no drag-to-reorder yet

## Next Steps
1. **Run migration 014** in Supabase dashboard (paste `supabase/migrations/014_events.sql`)
2. Test with real program — verify existing estimates appear inside their backfilled event
3. Merge `feat/events-layer` to main
4. Optional follow-ups: event edit UI, drag-to-reorder events
5. Real-proposal validation (compare engine output to Excel)
6. PDF/Canva export

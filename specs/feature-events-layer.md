# Feature: Events Layer (Program → Events → Estimates)

## Goal
Insert an `events` table between `programs` and `estimates`. Each program has multiple events (e.g. day 1 dinner, day 2 session), each event has multiple estimates. Backward-compatible: all existing estimates are backfilled into a default event per program.

## Interpretation Decisions
- **Guest count inheritance**: event.guest_count is stored and displayed on the event card header. The pricing engine continues to use program-level guestCount for all calculations. Per-estimate guest count is deferred.
- **Budget toggle**: estimate-level `include_in_budget` toggle is persisted (existing behavior). Event-level expand/collapse is client-side only and does not affect the budget total. Budget total = sum of all estimates where include_in_budget=true, regardless of which event they belong to.
- **event_id nullable**: backfill migration links all existing estimates. NULL event_id estimates are shown in an "Unassigned" section as a safety net — should be empty after migration.
- **Edit event**: not in scope for this session (add + delete only). Edit UI is a follow-up.

## Approach

### 1. Migration (014_events.sql)
- CREATE TYPE event_type ENUM (10 values)
- CREATE TABLE events (program_id FK, name, event_date, start_time, end_time, guest_count, event_type, description, sort_order)
- ALTER TABLE estimates ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE SET NULL
- Backfill: INSERT one "Program Events" event per program that has estimates, then UPDATE estimates to point to it
- RLS: authenticated users can manage events

### 2. queries.ts
- Add DbEvent interface
- Add event_id to DbEstimate
- Update ESTIMATE_FIELDS constant
- Add getEventsForProgram(programId) query

### 3. actions.ts (programs/actions.ts)
- Add createEvent(programId, data)
- Add updateEvent(id, data)
- Add deleteEvent(id)
- Update createEstimate signature to accept optional eventId

### 4. Component: AddEstimateButton.tsx
- Add optional eventId prop, pass to createEstimate

### 5. Component: AddEventButton.tsx (new)
- Inline expandable form: name, date, start/end time, guest count, event type, description
- Calls createEvent → router.refresh()

### 6. Component: EventsView.tsx (new, replaces ComparisonView in page.tsx)
- Client component
- Shows Total Budget banner (sum of include_in_budget estimates across all events)
- Shows event cards (collapsed/expanded toggle per event)
- Each event card: type badge (color-coded), name, date/time, guest count, estimate mini-cards, Add Estimate button
- Unassigned estimates section (safety net)
- Event delete button (on hover)

### 7. page.tsx update
- Add getEventsForProgram to parallel fetches
- Group estimate cards by event_id
- Build EventWithCards[] (event + its pre-calculated estimate cards)
- Replace ComparisonView with EventsView

## Key Files
- `supabase/migrations/014_events.sql`
- `src/lib/supabase/queries.ts`
- `src/app/(programs)/programs/actions.ts`
- `src/components/estimates/AddEstimateButton.tsx`
- `src/components/estimates/AddEventButton.tsx` (new)
- `src/components/estimates/EventsView.tsx` (new)
- `src/app/(programs)/programs/[id]/page.tsx`

## Done When
- Migration SQL is written and ready to run in Supabase dashboard
- All 74 existing tests pass
- `/programs/[id]` page renders events with their estimates grouped underneath
- "Add Event" form works and creates a new event
- "Add Estimate" within an event creates an estimate linked to that event
- Existing estimates (backfilled) render correctly
- Clicking an estimate card navigates to `/programs/[id]/estimates/[estimateId]` (unchanged)
- The estimate builder pages work without modification

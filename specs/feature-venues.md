# Feature: Venues Database

## Goal
Add a reusable Venues database so planners can link estimates to known venues, auto-fill standard fee fields, and track when a venue was last priced.

## Approach

### Schema (migration 015)
- `venues` table: id, name, address, city, state, zip, service_styles (text[]), contact_name, contact_email, contact_phone, website, notes, last_used_date, created_at, updated_at
- `venue_spaces` table: id, venue_id FK, name, capacity_seated, capacity_standing, fb_minimum, room_fee, service_charge_default, gratuity_default, admin_fee_default, notes, created_at, updated_at
- Add `venue_id UUID REFERENCES venues(id) ON DELETE SET NULL` and `venue_space_id UUID REFERENCES venue_spaces(id) ON DELETE SET NULL` to `estimates`
- Auto-seed: one venue per unique name from existing venue-type estimates

### Data Layer
- `DbVenue`, `DbVenueSpace` interfaces in queries.ts
- `getVenues()`, `getVenue(id)`, `getVenueSpaces(venueId)`, `getVenueWithSpaces(id)`

### Server Actions (src/app/(programs)/venues/actions.ts)
- `createVenue`, `updateVenue`, `deleteVenue`
- `createVenueSpace`, `updateVenueSpace`, `deleteVenueSpace`
- `linkVenueToEstimate(estimateId, venueId, venueSpaceId)` — updates estimate, updates venue.last_used_date

### Nav
- Add "Venues" between Programs and Reference Data — visible to all authenticated users

### /venues page
- Server Component with search param
- Searchable by name (client-side filter)
- Filter by city, state, service style, capacity min/max
- Table: name, city/state, service styles (tags), # spaces, capacity range, last used date
- "+ Add Venue" button opens inline form

### /venues/[id] page
- Server Component, edit all venue fields inline
- Spaces & Rooms section: list of spaces with inline add/edit/delete

### EstimateBuilder (venue type only)
- "Link Venue" searchable dropdown in the header area
- When venue selected → show "Select Space" dropdown + "Last priced: [date]" if set
- When space selected → auto-fills: roomSpace, fbMinimum, serviceChargeOverride, gratuityOverride, adminFeeOverride
- "Save to Venues" button — creates new venue+space from current estimate fields, links estimate to the new venue

## Key Files
- `supabase/migrations/015_venues.sql`
- `src/lib/supabase/queries.ts` — add interfaces + queries
- `src/app/(programs)/venues/actions.ts` — new
- `src/app/(programs)/venues/page.tsx` — new
- `src/app/(programs)/venues/[id]/page.tsx` — new
- `src/components/venues/VenuesList.tsx` — new (client filter/search)
- `src/components/venues/VenueForm.tsx` — new
- `src/components/venues/SpacesManager.tsx` — new
- `src/components/estimates/LinkVenuePanel.tsx` — new (venue/space dropdowns in builder)
- `src/app/(programs)/layout.tsx` — add Venues nav link
- `src/app/(programs)/programs/[id]/estimates/[estimateId]/page.tsx` — pass venue data

## What Done Looks Like
- /venues lists all venues, searchable, links to detail
- /venues/[id] shows venue fields + spaces, all editable
- Venue builder header shows Link Venue + Save to Venues
- Linking a venue/space auto-fills fees and updates last_used_date

## Skipped (out of scope)
- Fuzzy match on every auto-save (conflicts with auto-save architecture — "Save to Venues" button covers the use case explicitly)
- Room fee as a separate line item (stays manual; too complex for initial version)

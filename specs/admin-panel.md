# Spec: Supabase Setup + Admin Panel

## Goal
Stand up the Next.js foundation, Supabase integration, auth, and an admin panel with inline-editable tables for the three reference data tables: locations, category_markups, and team_hours_tiers.

## Approach

### 1. Next.js Foundation
Create the missing config files (next.config.js, tailwind.config.ts, postcss.config.js), root layout, global CSS, and app entry point. The initial scaffold left these empty.

### 2. Supabase Client Setup
- `src/lib/supabase/client.ts` — browser client (singleton)
- `src/lib/supabase/server.ts` — server client using @supabase/ssr with cookies
- `src/lib/supabase/queries.ts` — typed read queries for reference tables

### 3. Auth
- `middleware.ts` — protects all routes except /login; redirects unauthenticated users
- `src/app/(auth)/login/page.tsx` — email/password login form
- No signup page (Gary creates accounts via Supabase dashboard)

### 4. Admin Panel
Single page at `/admin` with three sections (Locations, Category Markups, Team Hours Tiers), each rendered as a spreadsheet-style editable table.

**Inline editing behavior:**
- Click any cell → becomes an `<input>` or `<select>`
- On blur (or Enter) → auto-save via Server Action
- Optimistic UI: update local state immediately, revert on error
- Toast-style feedback on save error

**Row operations:**
- Add row: appends a blank row in editing state
- Delete row: confirmation dialog, then Server Action, then remove from local state
- Rows that haven't been saved yet (new, unsaved) shown with a subtle indicator

**Server Actions (`src/app/(admin)/admin/actions.ts`):**
- `upsertLocation(data)` → INSERT or UPDATE
- `deleteLocation(id)` → DELETE
- `upsertMarkup(data)` → INSERT or UPDATE
- `deleteMarkup(id)` → DELETE
- `upsertTier(data)` → INSERT or UPDATE
- `deleteTier(id)` → DELETE

All actions use the server Supabase client (respects RLS).

### Key Files
```
next.config.js
tailwind.config.ts
postcss.config.js
src/app/layout.tsx                    Root layout (font, Tailwind)
src/app/globals.css                   Tailwind directives
middleware.ts                         Auth guard
src/app/(auth)/login/page.tsx         Login page
src/app/(admin)/layout.tsx            Admin layout + nav
src/app/(admin)/admin/page.tsx        Admin page (3 sections)
src/app/(admin)/admin/actions.ts      Server Actions
src/components/admin/LocationsTable.tsx
src/components/admin/MarkupsTable.tsx
src/components/admin/HoursTable.tsx
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/queries.ts
```

### Supabase Setup (manual step for Gary)
1. Create project at supabase.com
2. Copy URL + keys into `.env.local`
3. Run `supabase/migrations/001_initial_schema.sql` in SQL editor
4. Run `supabase/seed/001_reference_data.sql` in SQL editor
5. Create at least one user via Authentication > Users in the dashboard

## Done When
- [ ] `npm run dev` starts without errors
- [ ] `/login` renders and authenticates against Supabase
- [ ] `/admin` is blocked for unauthenticated users, redirects to `/login`
- [ ] Locations table shows all 22 rows, supports inline edit, add, delete
- [ ] Markups table shows all 11 rows, supports inline edit, add, delete
- [ ] Hours table shows all 14 rows, supports inline edit, add, delete
- [ ] Changes persist on page reload (confirmed via Supabase dashboard)
- [ ] All tests still pass

---
name: Comparison View, Dashboard Search, Active Nav
description: Three UI features for QC Estimator — a scenario comparison view on the program detail page, client-side search on the programs dashboard, and an active nav indicator using pathname detection.
type: project
---

# Spec: Comparison View, Dashboard Search, Active Nav

## Goal

Ship three focused UI improvements that make the estimator more usable for the QC Event Design team:

1. Replace the flat estimates table on `/programs/[id]` with comparison cards that surface key pricing metrics side-by-side and let the team toggle which estimates roll into the program budget.
2. Add client-side search to the programs dashboard so planners can find programs by name or client without a round-trip to the server.
3. Show which section of the app the user is in via an active nav link indicator.

---

## Feature 5: Scenario Comparison View

**Route:** `/programs/[id]`

**Behavior:**

- The page server component fetches all estimates for the program and runs `calculateVenueEstimate` for each one to produce engine summaries.
- Summaries and raw estimate rows are passed as props to `ComparisonView`, a client component.
- Each estimate renders as a card showing:
  - Venue name (linked to `/programs/[id]/estimates/[estimateId]`)
  - Total client cost
  - Price per person
  - Line item count
- The card with the lowest total is highlighted green (border + background tint).
- Each card has an "Include in Budget" toggle. Toggling updates the `include_in_budget` boolean on the `estimates` row via a server action — no full page reload.
- A "Total Budget" banner at the top of the view sums all toggled-on estimate totals and updates instantly as toggles change.

**Key files:**

- `src/app/(programs)/programs/[id]/page.tsx` — fetch estimates, run engine, pass to ComparisonView
- `src/components/estimates/ComparisonView.tsx` — client component, cards, toggle state, budget banner
- `src/app/actions/estimates.ts` — server action: `toggleIncludeInBudget(estimateId, value)`

**Constraints:**

- Engine call (`calculateVenueEstimate`) runs server-side only; no engine imports in the client component.
- Toggle must optimistically update local state before the server action resolves.
- If only one estimate exists, skip the "lowest cost" highlight — it adds no information.

---

## Feature 6: Dashboard Search

**Route:** `/programs`

**Behavior:**

- The programs page remains a Server Component. It fetches all programs and passes the full list to `ProgramsTable` as a prop.
- `ProgramsTable` is a client component with a controlled search input.
- Filtering is in-memory (no server round-trip): matches on `name` or `client_name`, case-insensitive substring.
- When `client_name` is null, display "No client yet" in gray italic in that column cell.
- Search input clears on mount (no stale URL state needed for v1).

**Key files:**

- `src/app/(programs)/programs/page.tsx` — server fetch, passes `programs` array to ProgramsTable
- `src/components/estimates/ProgramsTable.tsx` — client component with search state and filtered render

**Constraints:**

- No debounce needed at this scale (< 500 programs expected).
- Do not move data fetching into the client component — server fetch stays in the page.

---

## Feature 7: Active Nav Indicator

**Behavior:**

- Extract nav link definitions and rendering into a `NavLinks` client component.
- Uses `usePathname()` to compare each link's `href` against the current path.
- Active link styles: `text-blue-600 font-medium`. Inactive: default text color.
- Match strategy: `pathname === href` for exact routes; `pathname.startsWith(href)` for section roots (e.g., `/programs` should stay active on `/programs/[id]`).
- Both layout files import and render `NavLinks` — no duplicated link lists.

**Key files:**

- `src/components/layout/NavLinks.tsx` — client component with link definitions and active logic
- `src/app/(admin)/layout.tsx` — replace inline nav with `<NavLinks />`
- `src/app/(programs)/layout.tsx` — replace inline nav with `<NavLinks />`

**Constraints:**

- `NavLinks` must be a client component (`'use client'`) because `usePathname` is a client-only hook.
- Link definitions live inside `NavLinks` — not passed as props — to keep call sites clean.
- Admin and programs layouts show different link sets; use a `section` prop (`"admin" | "programs"`) to switch between them, or define two named exports (`AdminNavLinks`, `ProgramsNavLinks`) if the sets diverge significantly.

---

## Key Files

| File | Feature | New or Modified |
|---|---|---|
| `src/app/(programs)/programs/[id]/page.tsx` | 5 | Modified |
| `src/components/estimates/ComparisonView.tsx` | 5 | New |
| `src/app/actions/estimates.ts` | 5 | New or modified |
| `src/app/(programs)/programs/page.tsx` | 6 | Modified |
| `src/components/estimates/ProgramsTable.tsx` | 6 | New |
| `src/components/layout/NavLinks.tsx` | 7 | New |
| `src/app/(admin)/layout.tsx` | 7 | Modified |
| `src/app/(programs)/layout.tsx` | 7 | Modified |

---

## Done When

- [ ] Feature 5: `/programs/[id]` shows comparison cards with venue name link, total, price/person, and line item count; lowest-cost card is green; "Include in Budget" toggle persists to DB; Total Budget banner reflects toggled-on sum.
- [ ] Feature 6: `/programs` search input filters the list by name or client name without a page reload; null `client_name` displays as "No client yet" in gray italic.
- [ ] Feature 7: Active nav link shows blue text and font-medium weight in both layouts; inactive links are unstyled; no duplicate link definition exists in the codebase.
- [ ] No TypeScript errors (`npx tsc --noEmit` passes).
- [ ] All existing Vitest tests pass.

# CLAUDE.md — QC Estimator

## Project Overview
QC Estimator is an internal pricing tool for QC Event Design, a corporate event planning company based in Lake Wylie, SC. It replaces a 30+ tab Excel workbook with a web application that centralizes reference data (tax rates, category markups, travel costs, commission rules) and provides a clean UI for building multi-scenario venue estimates with automated pricing calculations, margin analysis, and export for Canva proposals.

**Owner:** Gary Stack (Stack Industries LLC)
**End Users:** QC Event Design team (3-5 non-technical event planners)
**Stack:** Next.js 14+ (App Router), TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS, Vercel
**Status:** Phase 1 — In Development

## Directory Structure
```
qc-estimator/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes (pricing engine, export)
│   │   ├── (auth)/             # Auth pages (login, signup)
│   │   ├── (dashboard)/        # Dashboard / proposal list
│   │   ├── (estimates)/        # Estimate builder pages
│   │   └── (admin)/            # Admin panel (tax rates, markups, travel)
│   ├── components/
│   │   ├── ui/                 # Reusable UI components (buttons, inputs, tables)
│   │   ├── estimates/          # Estimate-specific components (line items, scenario tabs)
│   │   ├── admin/              # Admin panel components (editable tables)
│   │   ├── layout/             # Layout components (nav, sidebar, header)
│   │   └── export/             # Export/copy components
│   ├── lib/
│   │   ├── engine/             # Pricing calculation engine (CORE BUSINESS LOGIC)
│   │   ├── supabase/           # Supabase client, queries, types
│   │   └── utils/              # Formatting, helpers
│   ├── types/                  # TypeScript type definitions
│   └── hooks/                  # Custom React hooks
├── tests/
│   ├── unit/                   # Unit tests (especially pricing engine)
│   ├── integration/            # API route tests
│   └── fixtures/               # Sample data matching real proposals
├── docs/                       # Design decisions, user guide
├── scripts/                    # Data migration, seed scripts
├── supabase/
│   ├── migrations/             # SQL migration files
│   └── seed/                   # Seed data (tax rates, markups, travel rates from Excel)
├── .github/workflows/          # CI/CD
├── .env.example
├── .gitignore
├── CLAUDE.md                   # This file
├── PRD.md                      # Product requirements
└── README.md
```

## Critical Business Logic

### Pricing Engine (src/lib/engine/)
This is the heart of the application. The pricing engine must produce IDENTICAL results to the Excel workbook for the same inputs. Any deviation will cause the team to lose trust and revert to Excel.

**Core formula:** `clientCost = ourCost × (1 + categoryMarkup%)`

**Category markups (11 categories):**
- Catering & F&B: 55%
- Venues & Room Rentals: 60%
- AV & Production: 65%
- Décor & Design: 85%
- Entertainment: 75%
- Activities & Experiences: 75%
- Transportation: 75%
- Staffing & Labor: 90%
- Purchased / Sourced Items: 200%
- Delivery & Logistics: 85%
- Tours & Guided Experiences: 65%
- Absolute floor: 50% (no exceptions without owner approval)

**Tax model:** Three separate tax rates per location (food, alcohol, general sales). 22 locations in the initial dataset, all at the county/city level. Tax rates are applied per line item based on the item's tax type.

**Restaurant fee structure (Venue estimates only):**
- Service Charge: 20% or 21.5% or None (applied to F&B subtotal)
- Gratuity: 20% or None (applied to F&B subtotal)
- Admin Fee: 5% or None (applied to F&B subtotal)
- Defaults set at program level, overridable per venue

**Commission layers:**
- CC Processing Fee: 3.5% on subtotal
- Client Commission: 5% default (variable, sometimes 0%)
- GDP Commission: 6.5% toggle (Yes/No, rate never changes)
- Third-party commissions: variable, added per-program

**Production Fee formula:**
`productionFee = subtotal × ccProcessingRate + markupRevenue × clientCommission`

**Margin health thresholds:**
- QC Margin: ≥35% Strong, ≥28% On Target, ≥22% Review, <22% Below Floor
- True Net (after hours + travel): ≥15% Strong, ≥7% On Target, ≥0% Thin, <0% Losing Money

**Team hours:** Looked up from a 14-tier revenue table, multiplied by $90/hr for OpEx estimate.

### Key Rule: The pricing engine MUST be framework-agnostic TypeScript in src/lib/engine/. No React, no Next.js, no Supabase imports. Pure functions that take inputs and return calculated results. This makes it testable and portable.

## Session Protocol

### Starting a Session
1. Read this CLAUDE.md
2. Check PRD.md for current phase and status
3. Run tests: `npm test`
4. Check for any failing tests before making changes
5. Ask Gary what we're working on today

### During a Session
- Run tests after every significant change
- Commit after each completed feature or fix
- Update the Design Decisions Log for non-obvious choices
- Never modify the pricing engine without adding or updating tests first

### Ending a Session
1. Run full test suite: `npm test`
2. Fix any failing tests
3. Update the Current TODOs section below
4. Update PRD.md phase status if applicable
5. Commit with descriptive message
6. Summarize what was done and what's next

## Communication Preferences
- Direct and honest — no filler, no enthusiasm
- If something is wrong with the approach, say so immediately
- Use the same terminology as the Excel workbook (F&B Minimum, Service Charge, Production Fee, etc.)
- The end users are non-technical — UI copy should be plain English, never developer jargon
- When in doubt about a pricing edge case, ask Gary rather than guessing

## Coding Standards

### TypeScript
- Strict mode enabled
- No `any` types — everything is explicitly typed
- Types for all database tables in src/types/
- Use Zod for runtime validation of inputs

### React / Next.js
- Server Components by default, Client Components only when interactivity is needed
- Use `use server` actions for form submissions
- Keep components small and focused
- No prop drilling deeper than 2 levels — use context or composition

### Supabase
- All queries go through src/lib/supabase/ — no direct Supabase calls in components
- RLS policies on all tables
- Migrations in supabase/migrations/ with descriptive names
- Seed data in supabase/seed/ — includes all reference data from the Excel workbook

### Testing
- Vitest for unit tests
- Pricing engine has 100% test coverage — no exceptions
- Every calculation path must have a test with expected values from the Excel workbook
- Test fixtures should mirror real proposal data

### Styling
- Tailwind CSS only — no CSS modules, no styled-components
- Use consistent spacing scale
- Mobile-responsive but optimize for desktop/tablet (this is a data-entry app)

## Design Decisions Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| 2026-04-03 | Build custom vs buy Curate | Curate doesn't support tri-rate taxes, 11 category markups, multi-scenario comparison, or internal margin analysis. Recent botched migration is a red flag. | Curate (~$100+/mo), Airtable + custom frontend, enhanced Excel |
| 2026-04-03 | Next.js + Supabase + Vercel | Gary's proven stack. Zero new technology risk. Supabase handles auth + RLS + admin-friendly table editor as backup. | Python/Django (slower frontend iteration), Rails (unfamiliar) |
| 2026-04-03 | Pricing engine as pure TypeScript | Must be testable independent of UI. Must produce identical results to Excel. Can't have framework dependencies polluting business logic. | Inline calculations in React components (untestable, fragile) |
| 2026-04-03 | Single EstimateSummary type for all estimate types | AV and Decor map into the same summary fields (equipment→taxable, qcStaffing→non-taxable). Keeps engine simple; ExportButtons uses estimateType prop to relabel fields for copy output. | Separate summary types per estimate type (more code, same data shape) |
| 2026-04-03 | Travel Expenses as full-width section below line items | Sidebar (288px) was too narrow for trip fields to be usable. Three trips render in 3-column grid at full width. Sidebar now contains only Summary + Margin Analysis. | Sidebar placement (rejected — unusable), separate travel page |
| 2026-04-03 | ComparisonView groups cards by type | Lowest/Best Margin badges should only compare within the same category (venue vs venue, AV vs AV). Cross-type comparison is meaningless. | Single flat grid with type badge on each card (rejected — misleading badges) |
| 2026-04-03 | UserMenu as thin client component receiving email as prop | Layout is a Server Component that already has the user. Passes email as prop to avoid a redundant client-side session fetch. | Client component fetching its own session (extra round trip) |
| 2026-04-26 | PDF extraction via Claude API server action only | API key must never reach the browser. All extraction logic lives in `extractAttachmentData()` in `actions.ts` — downloads from Storage, sends base64 doc block to `claude-sonnet-4-6`, stores JSON result in `extracted_data` JSONB column. | Client-side API call (rejected — exposes key), separate API route (unnecessary with server actions) |
| 2026-04-26 | Populate Line Items only wired in venue (EstimateBuilder), not AV/Decor | Menu PDFs are venue artifacts — food/alcohol/NA beverages map to F&B section with Catering & F&B markup. AV and Decor builders don't pass `onPopulateLineItems` so the button is hidden. | Show button in all builders (rejected — no meaningful section mapping for AV/Decor) |
| 2026-04-26 | Transportation stored our_cost/client_cost in schedule rows | Comparison view needs aggregates without a complex JOIN+math query. Decouples quoted costs from future rate card edits. | Compute from JOIN at query time (complex), denormalized total on estimates (drifts) |
| 2026-04-26 | Transportation uses fake EstimateSummary to reuse calculateMarginAnalysis | Avoids a separate margin engine for transportation. Sets equipmentSubtotalClient = subtotalClient, uses transportCommission as clientCommission, gdpCommissionEnabled=false. | Duplicate margin logic (maintenance burden) |
| 2026-04-26 | Program-level PDFs: extraction is automatic on drop; population is manual per-doc | Users need to review extracted fields before applying them. Overwrite confirmation lists exact fields that would change. Location auto-selects only if exactly 1 location name fuzzy-matches the locationHint tokens. | Auto-populate on extraction (rejected — no overwrite visibility) |
| 2026-04-29 | Gmail scanner: long-running daemon + node-cron, not PM2 cron_restart | PM2 cron_restart restarts the full process on schedule; long-running + cron.schedule() keeps the process alive and fires scans. Simpler. | PM2 cron_restart (rejected — process overhead), Vercel cron (not suitable for daemon with OAuth tokens) |
| 2026-04-29 | Scanner uses relative imports only, not @/ path aliases | tsx runs scripts outside Next.js build context — tsconfig `moduleResolution: "bundler"` causes resolution failures with @/ aliases. All scanner files use relative imports (../../src/lib/...) | @/ aliases (rejected — tsx resolution failures at runtime) |
| 2026-04-29 | Leads table inline editing uses a local edit overlay (Map) not useState copy of rows | A useState copy of rows needs useEffect to re-sync when props update (after AddLeadPanel refresh). The overlay pattern applies edits on top of the server-fetched props without blocking prop updates. | useState copy with useEffect sync (rejected — race condition risk) |
| 2026-04-29 | ~~Team members sourced from auth.admin.listUsers()~~ — superseded 2026-05-01 | Superseded by team_members table (migration 019). auth.users approach required service role key for every read and had no role/title data. | See 2026-05-01 decision below |
| 2026-05-01 | lineItemsRef.current updated inside setLineItems functional updater, not just on render | React 18 concurrent mode may defer renders past setTimeout(0). Writing `lineItemsRef.current = next` inside the functional updater ensures handleItemSave reads the latest state when it fires, even if React hasn't re-rendered yet. | Update ref only on render (original pattern — race condition with setTimeout saves) |
| 2026-05-01 | Label field stored on estimate_line_items, not derived from extraction name | The team wants a separate short internal descriptor independent of the vendor item name. Extraction auto-populates it from Claude's label suggestion; users can edit freely. Not included in templates (templates are blueprints; labels are per-estimate). | Reuse name field (conflates vendor name with internal tracking) |
| 2026-05-01 | team_members table as owner source of truth, not auth.users | auth.users is an auth concern; team roster is a business concern. team_members seeds 9 real team members with first_name, last_name, role — stable, queryable, no service role key required for reads. assigned_to on leads is INTEGER FK to team_members(id). | auth.admin.listUsers (requires service role key everywhere, no row-level data), hardcoded array (brittle) |
| 2026-05-01 | WriteLeadResult discriminated union: `{ id }` / `{ skipped: string }` / null | writeLead() has two distinct non-error outcomes: success (id) and intentional dedup skip (client_name+start_date). Returning null for both would cause callers to miscount skips as errors and fail to call markProcessed(). Discriminated union lets callers handle all three cases correctly. | Return null for both (ambiguous), throw a SkipError class (heavier) |
| 2026-05-01 | Scan Now button calls POST /api/scanner/run, not a server action | Server actions can't show in-flight loading state from the client — the button needs to toggle a spinner and render a toast after completion. An API route + fetch() from a client component is the right pattern for user-initiated async jobs. | Server action (no mid-flight UI feedback), WebSocket (overkill) |

## Gotchas Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2026-04-03 | QC monogram PNG is dark — invisible on dark charcoal nav | Added `brightness-0 invert` Tailwind filter classes to the Image in both layouts. No separate white asset needed. |
| 2026-04-03 | Supabase password reset requires /reset-password in Redirect URLs allowlist | Must add the URL in Supabase dashboard → Auth → URL Configuration, otherwise the reset link is blocked. |
| 2026-04-26 | JS falsy `\|\|` trap with numeric 0: `parseFloat('0') / 100 \|\| 0.05` evaluates to `0.05` because `0` is falsy | Use `isNaN(v) ? fallback : v / 100` pattern wherever a numeric field has a meaningful zero value (client commission, CC fee, etc.) |
| 2026-04-26 | Stale closures in `useCallback` + `setTimeout`: category changes weren't saving because `handleItemSave` captured old `lineItems` state | Use a `lineItemsRef` (updated every render via `lineItemsRef.current = lineItems`) and read from `lineItemsRef.current` inside callbacks instead of the closed-over state variable |
| 2026-04-26 | Git heredoc `$(cat <<'EOF'...)` fails in bash on Windows when run from PowerShell | Use PowerShell's `@'...'@` here-string syntax for multiline git commit messages on this machine |
| 2026-04-26 | estimate_type is a PostgreSQL ENUM — adding new estimate types requires ALTER TYPE | Adding 'transportation' to AddEstimateButton without also running `ALTER TYPE estimate_type ADD VALUE 'transportation'` caused silent INSERT failures. Always add a migration when introducing a new type. |
| 2026-04-26 | Transportation PDF extraction returned no data despite API call succeeding | `ExtractedData` didn't include `vehicleRates`/`scheduleRows` fields; normalizer silently discarded them. Added types + branched normalizer on estimateType. |
| 2026-04-26 | AttachmentsPanel showed "No data found" for transportation even with 7 vehicleRates in DB | `ExtractionResultPanel` only checked `menuItems`/`equipmentItems` for the no-data guard. Added `estimateType` prop and branched all checks. |
| 2026-04-26 | Program attachment uploaded on create was invisible after redirect | `uploadProgramAttachment` select didn't include `extracted_data`; no URL was generated. Updated select + added `getProgramAttachments` / `deleteProgramAttachment` actions. |
| 2026-04-29 | `returning_client` regex in parseWithRegex tested if the *value* contained "returning" | The regex `/returning\|repeat/i.test(extractField(...))` tested the field value ("Yes") not the field label. Fix: pass the raw string to Zod schema which handles `yes\|true\|y\|1` transform. Always let Zod transforms handle boolean coercion, not pre-processing regexes. |
| 2026-04-29 | Scanner committed to feat/scanner-phase2; subsequent UI work committed to main | Session started on main (gitStatus showed main, clean). Scanner work was on feat/scanner-phase2. LeadDetail and leads-UI commits landed on main before feat/scanner-phase2 was merged. Merge feat/scanner-phase2 to main before deploying scanner. |
| 2026-05-01 | scanner-phase2 was already on main at session start | git log showed `10c0c89 feat: add Gmail scanner Phase 2` on main — already merged from a prior session. The Gotchas note was stale. Removed from Remaining TODOs. |
| 2026-05-01 | React `<select value={id}>` shows "Unassigned" for all rows when id is an integer | HTML option values are always strings in the DOM. React coerces for matching but the behavior can be inconsistent when the JS value is a number. Fix: always use `String(m.id)` for option values and `id != null ? String(id) : ''` for the select value. Never pass raw integer IDs to select/option value props. |
| 2026-05-01 | `node --loader tsx` is deprecated in newer Node versions | All npm scripts using `node --loader tsx script.ts` were broken. Replace with `npx tsx script.ts` — tsx handles its own loader registration. |

## Current TODOs

### Completed ✓
- [x] Scaffold, Supabase setup, seed reference data, pricing engine (122 tests), admin panel, estimate builders, export, travel calculator, file attachments, auth, nav, PDF extraction, transportation builder, leads pipeline phases 1 & 2, inline editing, label field (see git log for full history)
- [x] team_members table (migration 019) — seeds 9 members, assigned_to on leads is now INTEGER FK to team_members(id)
- [x] Scanner owner lookup: writer.ts queries team_members by first_name match instead of auth.admin.listUsers
- [x] client_name + start_date dedup in writeLead — prevents duplicate leads from different emails describing the same event
- [x] WriteLeadResult discriminated union — callers distinguish inserted / skipped / error; skipped messages get markProcessed() to prevent reprocessing
- [x] scripts/dedup-leads.ts — one-time cleanup script, keeps oldest per client_name+start_date group (`npm run dedup`)
- [x] scripts/backfill-leads.ts — 12-month Gmail backfill with paginated fetch and Supabase dedup (`npm run backfill`)
- [x] npm scripts: replaced `node --loader tsx` with `npx tsx` for all four scripts (scan, auth, backfill, dedup)
- [x] Owner dropdown integer/string fix — explicit `String(m.id)` on all option values and select values in LeadsList and LeadDetail
- [x] Scan Now button (ScanNowButton.tsx) + POST /api/scanner/run — manual on-demand scan with spinner and toast; schedule note "Auto-scans daily at 7am, 11am, 2pm, 4pm ET"

### Remaining
- [ ] **Run migration 018 in production Supabase:** `ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS label TEXT;`
- [ ] **Run migration 019 in production Supabase:** `supabase/migrations/019_team_members.sql` (team_members table + drops/re-adds leads.assigned_to as integer FK)
- [ ] **Run `npm run dedup`** after 019 migration to clean up any duplicate leads created before the dedup logic was in place
- [ ] Set up Gmail OAuth credentials + run `npm run auth` to get refresh token for scanner
- [ ] Deploy scanner daemon to Mac with PM2 (all code is on main; env vars needed: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, NOTIFY_EMAIL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY)
- [ ] Validate against 3-5 real historical proposals — compare engine output to Excel for same inputs
- [ ] PDF/Canva export — format for client-facing proposals
- [ ] Mobile polish — currently optimized for desktop/tablet only
- [ ] Role-based access — admin vs user distinction exists in DB but UI enforcement is minimal

### Next Session Start
- Run migrations 018 and 019 in production Supabase (SQL editor), then run `npm run dedup` to clean up any duplicate leads.
- Deploy scanner daemon to Mac with PM2 — all code is on main. Run `npm run auth` once first to generate the refresh token.
- After scanner is live: run `npm run backfill` once to import the last 12 months of INITIAL LEAD emails.
- Real-proposal validation is the best next feature step.

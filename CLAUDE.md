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
| 2026-05-05 | Lead status constants extracted to src/lib/leads/constants.ts | LeadStatus, LeadStatusGroup, OPEN/PAUSED/CLOSED_STATUSES live here — no server imports. queries.ts re-exports from it. Client components import from constants.ts directly, never from queries.ts for runtime values. | Inline in queries.ts (breaks client builds), duplicate in each component |
| 2026-05-05 | Leads pipeline overhaul — 12 statuses, status groups (Open/Paused/Closed), 13 new columns | Migration 020 run in production. status tabs now group by Open/Paused/Closed (default Open). Table is horizontally scrollable, default sort start_date asc. All new dropdown cols inline-editable. | Old 4-value enum (kept for reference in migration file) |
| 2026-05-05 | Leads table: dual-axis scroll with fixed viewport height | Table in overflow-auto max-h-[calc(100vh-300px)] container so both scrollbars appear within the viewport. thead is sticky top-0. Client column frozen sticky left-0 with group-hover bg sync. Section headers sticky top-8 (below thead). | Horizontal-only scroll (scrollbar off-screen), separate sticky component (overkill) |
| 2026-05-05 | ~~Scan timestamp groups replace "Latest Scan" / "Earlier" labels~~ — superseded 2026-05-12 | Superseded by flat list. See 2026-05-12 decision. | — |
| 2026-05-05 | ScanNowButton: router.refresh() after scan + 60s auto-poll | router.refresh() fires immediately after POST /api/scanner/run returns. setInterval(60s) calls router.refresh() in background; shows "Updated just now" for 8s. | Manual page refresh (poor UX), WebSocket (overkill for polling) |
| 2026-05-05 | Scanner writer maps to migration 020 column names with dropdown normalization | ParsedLead has source_advisor/source_coordinator/third_party_company/lead_source (old cols from migration 017). Migration 020 added gdp_advisor/gdp_coordinator/third_party/lead_source_type. writer.ts explicitly sets all 4 new cols via matchOption()/normalizeLeadSource() after spread. | Rename ParsedLead fields (breaks regex parser field labels), add DB migration to rename columns (destructive) |
| 2026-05-06 | EventsView per-person price recomputed from event guest_count, not pre-stored card value | card.pricePerPerson is computed in page.tsx using program guest count. Events have their own guest_count. EstimateCardItem now receives eventGuestCount prop and recomputes: ceil(total / eventGuestCount) when available, falls back to card.pricePerPerson. | Pass event count to page.tsx computation (requires more plumbing), store separate pp field (denormalized) |
| 2026-05-06 | buildLineItems in page.tsx now applies markup_override per item | Original code always used category default markup_pct. All three builders correctly apply item.markup_override ?? defaultMarkupPct; page.tsx was the outlier causing card totals to diverge from live summary. | Separate query for estimate cards (extra round trip) |
| 2026-05-06 | Copy Numbers venue export includes Service Charge, Gratuity, Admin Fee as separate rows | These fees are material line items clients need to see broken out. Values come from EstimateSummary fields already calculated by the pricing engine. Rows are omitted when 0. Order: ...Venue Rental, Service Charge, Gratuity, Admin Fee, Production Fee, Tax. | Lump into a single "Fees" row (loses transparency) |
| 2026-05-12 | Leads list: flat start_date-sorted list replaces scan-batch grouping | Alex (end user) wants events sorted by start date, not grouped by when the scanner ingested them. Scan batch grouping was an implementation detail that leaked into the UI. NEW badge (24h rolling window, copper pill) + "N new today" toggle button replace section headers for new-lead visibility. Sort applies universally — no isManual branch. | Keep scan batch groups with sort option (rejected — confusing to users), dot/badge only with no filter shortcut (rejected — no quick access to today's leads) |
| 2026-05-13 | isRevenueItem flag on LineItem: ourCost=0, clientCost=qty×unitPrice (no markup) | Coordinator Fee and similar QC-owned fees have no vendor. Setting ourCost=0 naturally excludes them from totalVendorCosts in margin analysis — no special margin logic needed. | Separate margin deduction path (more code, same result) |
| 2026-05-13 | Copy Numbers now uses buildDetailedCopyText (per-item rows + section subtotals) | Team uses Copy Numbers output for invoicing — they need individual line items, not grouped category totals. buildCopyText (grouped) is kept for potential future use. | Modify in-place (would break existing behavior); remove old function (might be needed later) |
| 2026-05-13 | Show Math toggle: showMath state lives in each builder, SummaryMathRates passed to panels | Math display is purely presentational; no new engine logic needed. SummaryMathRates carries rate data the builder already owns (fee overrides, programConfig rates). Panels back-calculate nothing — they receive rates and display formulas. MarginPanel derives totalClient from existing margin fields. | Context (prop drilling past 2 levels avoided by passing rates object); per-row expand/collapse (toggle-all is simpler for an internal audit tool) |
| 2026-05-13 | Margin formula: new qcRevenue = totalClient − vendorCostsBase − totalTaxes − ccProcessing − gdpComm − thirdParty | Taxes and CC processing are algebraic pass-throughs (cancel out); client commission is QC revenue (baked into totalClient via productionFee, not deducted). New fields: `vendorTaxesTotal` and `revenueItemsClientTotal` on EstimateSummary; `vendorCostsBase`, `totalTaxes`, `ccProcessingAmount` on MarginAnalysis. | Old formula: totalOur as vendor costs (included taxes + productionFee, double-counted client commission). |
| 2026-05-13 | MarginPanel redesigned as 'use client' waterfall with expandable sections | New formula requires showing individual cost buckets. vendorCosts and commissions are expandable via useState chevron toggles. Requires `summary: EstimateSummary` prop to show section-level vendor cost breakdown (F&B, Equipment, Venue, Staffing). TransportationEstimateBuilder had to extract `fakeSummary` to a separate useMemo to pass it as a prop. | Read-only server component (rejected — can't show expand/collapse without client state) |
| 2026-05-13 | Tax column in LineItemRow/LineItemSection: passes `location: Location` from programConfig down | Need tax rate + location name per item. `Location` is already in programConfig (available in all three builders). Helper `shortLocationName()` strips state abbrev and parenthetical to fit in 100px column. Two-line display: rate on top, abbreviated name below. | Tooltip-only (rejected — user wanted both visible); separate taxRates object (Location already has all fields needed) |
| 2026-05-13 | Program P&L panel: buildEstimateCard refactored to buildEstimateData returning {card, pnlRow} | Avoids double engine computation. pnlRow includes billing, vendorCosts, taxes, commissions, qcMargin, marginPct for each budgeted estimate. Panel only renders when include_in_budget estimates exist. | Separate loop re-running engine (wasteful); extending EstimateCard with PnL fields (bloats the card interface used everywhere) |
| 2026-05-13 | Guest count mismatch warning: amber ⚠ overlay on Qty input + banner above line items | Visual only — team intentionally uses different quantities sometimes. Warning fires when item.qty > 0 && item.qty !== program.guest_count (after effectiveProgram resolution). guestCount threaded as optional prop through LineItemSection → LineItemRow. | Error/blocker (rejected — too aggressive), tooltip-only (rejected — user wanted banner visibility) |
| 2026-05-13 | Mobile responsive: MobileNav client component, leads card view, programs overflow fix | MobileNav (hamburger, charcoal dropdown) shown on md:hidden; desktop nav hidden on mobile. LeadCard component mirrors table data for mobile. md:hidden card / hidden md:block table pattern. ProgramsTable gets overflow-x-auto + min-w-[600px]. | Separate mobile pages (overkill), table scroll on mobile (unusable with 17 columns) |
| 2026-05-13 | Proposal validation tests use engine-computed expected values, not Excel ground truth yet | Three scenarios with TODO markers. Tests pass as regression anchors against current engine. Gary validates against Excel to find discrepancies — if Excel differs, EXPECTED_* constants are the bug location. | Hardcode 0 (tests always fail), skip until Excel validation (no regression coverage) |
| 2026-05-22 | Client discount: applied after all fees, reduces totalClient and QC margin directly | discountAmount = totalClientPreDiscount × value (percent) or flat value. productionFee is computed on pre-discount subtotalClient — discount does not affect vendor costs or fees. migration 023 adds discount_type + discount_value to estimates. | Apply before productionFee (distorts fee calc), separate discount estimate (extra DB row) |
| 2026-05-22 | PDF proposal: @react-pdf/renderer with dynamic import inside click handler | Library can't be imported at module level (SSR crash). serverComponentsExternalPackages in next.config.js prevents Next.js from bundling it server-side. Dynamic `import()` inside handleExportPdf loads it only client-side on demand. ProposalDocument called as a function (not JSX) to avoid module-level JSX evaluation inside the dynamic import. | pdf-lib (lower-level, more verbose), server action (can't stream a blob download) |
| 2026-05-22 | Move line items: SECTION_DEFAULT_TAX record maps each LocalSection to its taxType default | When moving an item to a new section, both section and taxType are updated atomically so the engine re-prices correctly (F&B items use per-item taxType; equipment uses blanket generalTaxRate on the bucket). Selection state is a Set<string> of IDs in each builder; cleared after move completes. | UI-only section rename without taxType update (incorrect pricing); global context for selection (prop drilling depth ≤ 2, not worth context) |
| 2026-05-27 | Engine uses TaxBucket enum (fb/equipment/venue/staffing) — section display name is irrelevant to pricing | Enables user-defined section names without breaking tax calculations. Section name stored as text for backwards compat + display; taxBucket is the authoritative routing key. Removes DECOR_TAXABLE/DECOR_NONTAXABLE sets from engine. | Keep string matching (breaks on rename); separate tax routing table (unnecessary complexity) |
| 2026-05-27 | estimate_sections table with lazy ensureDefaultSections on first page load | Per-estimate section rows let the user rename/add/delete without touching pricing logic. Lazy seed (called when sections array is empty) handles pre-migration estimates without requiring a heavy migration script per estimate. LocalLineItem carries both sectionId (UUID FK) and section (display name, kept in sync). | Global sections table shared across estimates (renames would cross-contaminate); store only sectionId without display name (requires join on every render) |
| 2026-05-27 | Decor builder dropped Florals/Rentals parent card grouping — flat dynamic sections instead | Parent cards required knowing the sub-section names at compile time. With dynamic sections, any grouping would need a user-specified "group" concept — scope creep. Flat list is simpler to reason about. | Keep parent cards with hard-coded section names (breaks if user renames a sub-section) |
| 2026-05-27 | Slide Copy Module: slide_copy_data JSONB on estimates, auto-saved via server action | Avoids a separate slide_copy table; JSONB is flexible for future fields. Debounced 1.5s useEffect watches all state dependencies and writes via saveSlideCopyData(). Migration 026 adds the column. | Separate table (overkill for a single JSON blob), localStorage (lost on device change) |
| 2026-05-27 | Brand voice as pure TypeScript in src/lib/brandVoice.ts — no React deps | Bannned words, Oxford comma, number spelling, dash removal, currency format must be testable in isolation. 20 unit tests. Applied to allCopyText to surface warnings before copy. | Inline in component (untestable) |
| 2026-05-27 | Travel time via Google Maps Distance Matrix API — server action only, key never reaches browser | GOOGLE_MAPS_API_KEY is a server-side secret. getTravelTime() is a server action that calls the Maps API twice (driving + walking), applies traffic multipliers, returns formatted TravelResult. Fails silently in dev if key is absent. | Client-side fetch (exposes API key), stub (throwaway) |
| 2026-05-27 | Walking shown only when ≤1 mile AND ≤20 min (both conditions required) | A 9.2-mile walk shows up at SPIN Philadelphia otherwise. shouldShowWalking() enforces both gates before setting walkLine. | Show whenever faster than driving (misleading for long distances) |
| 2026-05-27 | "Copy to Canva" → Option B: button scrolls to Slide Copy and pre-fills menu selections | Option A (copy to clipboard as-is) loses dietary tags. Option B passes ExtractedData through pendingSlideMenuData state in EstimateBuilder, uses slideCopyRef for scroll. pendingMenuData useEffect in SlideCopySection consumes it once and calls onPendingMenuConsumed. | Option A: copy without dietary tags (rejected — spec requirement); Option C: separate page (overkill) |
| 2026-05-27 | Menu selection enhances extraction pipeline: dietary tags, selection rules, maxSelections per course | Tags carry through to Slide Copy output. extractedMenuToMenuCourses() maps the enhanced ExtractedMenuItem shape to MenuCourse[]. Existing extracted data can be re-extracted by hitting the parse button. | UI-only tags not persisted in extraction (lost on reload) |
| 2026-05-27 | Venue bio: fetch URL HTML + Claude API; fall back to name-based with "Verify accuracy" note | AbortSignal.timeout(8000) prevents hanging. Sqft/capacity hints extracted from HTML via regex and auto-fill empty fields. Same anthropic client pattern as extractAttachmentData. | Separate API route (unnecessary with server actions); pre-baked descriptions (stale) |
| 2026-05-27 | Formatted preview: Cormorant Garamond (headers) + Playfair Display (body), both via next/font/google | Bright Darling (Alex's preferred font) is not on Google Fonts. Cormorant substitutes for display headers. Playfair Display added as --font-display / font-display Tailwind key for body text. Preview note alerts Alex to swap in Canva. | System fonts (too plain for a preview mockup); single font (spec calls for two distinct serifs) |
| 2026-05-27 | SlideCopySection uses minimal SlideCopyLineItem interface instead of importing LocalLineItem | EstimateBuilder imports SlideCopySection; SlideCopySection can't import LocalLineItem from EstimateBuilder — circular import. Structural typing: SlideCopyLineItem has only {taxBucket, taxType, name, qty, isRevenueItem?}; LocalLineItem satisfies it without declaration. | Re-export LocalLineItem from a shared module (creates new shared dep for a shape already defined in EstimateBuilder) |
| 2026-05-28 | Drag-and-drop reordering: render prop pattern for SortableSectionItem | dnd-kit listeners/attributes must be on the drag handle element inside LineItemSection, but the sortable wrapper is the parent. Render prop `children: (dragHandle: ReactNode) => ReactNode` passes the handle in without coupling LineItemSection to dnd-kit. sort_order exists on both estimate_sections and estimate_line_items (migration 025) — no new migration needed. Items filtered with `.sort((a, b) => a.sortOrder - b.sortOrder)` after reorder to guarantee display order regardless of array position. | Global context for drag handle (prop drilling); dnd-kit imports in LineItemSection (couples component to dnd-kit) |
| 2026-05-28 | extractedMenuToMenuCourses moved to src/lib/slideCopy/menuMapping.ts — not in actions.ts | Next.js requires all exports in a 'use server' file to be async functions. extractedMenuToMenuCourses is a synchronous utility — can't live in actions.ts. Moved to a plain TS module; SlideCopySection imports from there instead. | Keep in actions.ts (Vercel build failure); make it async (wrong semantics for a pure transform) |
| 2026-06-01 | Summary panel labels derived from live sections (labelForBucket helper) | Hardcoded strings ("Floral Product", "Taxable AV Equipment") were disconnected from user-renamed sections. Engine taxBucket controls pricing; display label now reads from sections array. | Keep hardcoded labels (rejected — bug) |
| 2026-06-01 | Production fee taxed: new formula adds productionFeeTax to totalClient | Alex invoices include prod fee; clients pay tax on it. QC margin unchanged (prod fee tax is a pass-through). subtotalClient (tax-inclusive line items) remains the production fee calculation base — no circular dependency. | Apply before productionFee (circular), separate tax line (unnecessary complexity) |
| 2026-06-01 | Merge dialog: field comparison shows only differing fields; survivor pre-selected by updated_at | Most recently updated record is likeliest to be "correct." User can override. Confirmation step + warning before delete. | Show all fields (overwhelming with 40+ lead fields) |
| 2026-06-01 | ThumbnailCell: icon picker inline popover, photo via base64 upload to server action | API key never reaches browser. suggestIcon() keyword matching is instant + free; Claude API would add latency per new item. Icon SVGs in react-pdf are complex — photos shown via Image, icons show a placeholder square. | Client-side Claude call (rejected — exposes key) |
| 2026-06-02 | Travel time uses free-form From/To address inputs, not locked to client_hotel/linked venue | Team needs to calculate from restaurants, airports, and other non-hotel origins. Inputs default to client_hotel/venue when available but are fully editable. Values persist in slide_copy_data (travelOrigin, travelDest). | Hard-coded to program.client_hotel (rejected — too restrictive) |
| 2026-06-02 | PDF section order: pass orderedSections[] from each builder to ProposalDocument | ProposalDocument previously derived section order from Array.from(new Set(lineItems.map(li => li.section))) — item-level sort_order, not section-level. Each builder now computes [...sections].sort((a,b) => a.sortOrder - b.sortOrder).map(s => s.name) and passes it through ExportButtons. | Derive from lineItems insertion order (arbitrary when sections share sort_order 0) |
| 2026-06-02 | PDF extraction: removed 5-10 item cap; raised max_tokens to 16000 | "aim for 5–10 total" caused Claude to intentionally omit items on larger menus. max_tokens: 4096 cut off JSON responses for menus with many packages. Both fixed for text and document extraction paths. | Keep cap (rejects — legitimately misses items) |
| 2026-06-02 | Package options: packageOptions JSONB + selected_package_id on line items | When PDF has Package A/B/C at different prices, Claude returns one menuItem with packageOptions instead of separate flat items. PackageSelector component renders radio buttons. Selecting a package sets unitPrice = pricePerPerson. package-derived Slide 2 courses sync via "Sync from selections" button. | Separate line item per package (loses the group relationship), needsSelection (wrong — options have different prices, not sub-items within one price) |
| 2026-06-03 | Program lifecycle status: text column (not enum) with CHECK constraint | Three statuses: active/completed/did_not_book. Text avoids ALTER TYPE migrations when adding statuses later. archived_at set automatically when status → completed/did_not_book, cleared when → active. Default tab is Active. | PG enum (hard to extend), separate archived boolean (redundant with status) |
| 2026-06-03 | Venue force-address: required banner + inline add form in EstimateBuilder | venues.venue_id already exists on estimates (migration 015). Force is implemented as an amber warning banner (not a hard block) that disappears once auto-link fires on name blur. Inline "Add new venue" form in LinkVenuePanel creates venue + links estimate in one action. | Hard block (rejects — estimates are useful before venue is set); separate create-venue page (breaks flow) |
| 2026-06-03 | Duplicate venue address: soft check in createVenue action, no DB UNIQUE constraint | Returns { error, existingId, existingName } so the inline form can offer "Use that venue" button. address is nullable (NULL ≠ NULL so a DB unique constraint would need a partial index), and we want a user-friendly message not a DB error. | DB UNIQUE constraint (gives raw error, doesn't handle NULL); no check (allows silent duplicates) |
| 2026-06-03 | Auto-suggest tax location: venueCity passed as 3rd arg through onLinkChange | LinkVenuePanel passes city directly (from venues array for existing venues, from newCity form state for newly created ones) so the suggestion fires even when a new venue isn't yet in the venues prop array. Multiple matches = no suggestion (ambiguous). No match = amber "No tax location found for [city]" message. | Lookup venue from venues array only (broken for newly created venues) |
| 2026-06-03 | Venue profile history: getEstimatesForVenue + getAttachmentsForVenue now return { data, error } | Silent [] return masked query failures. Both functions expose error strings; venue detail page shows red error banners vs empty-state explanations vs populated data. Two-step query: get estimate IDs for venue → get attachments for those IDs. | Single JOIN query via raw SQL (would need a DB function) |
| 2026-06-03 | Force venue blocking: line items, Slide Copy, Travel, and ExportButtons hidden/disabled until venue_id is linked | triggerAutoLink (auto-create venue from estimate name on blur) removed — venue must be explicitly chosen. "Add new venue" is now the last <option> in the dropdown (sentinel __add_new__) rather than a separate button. | Warn-only amber banner (insufficient — allows saving without venue) |
| 2026-06-03 | Duplicate venue prevention: address required + name fuzzy check in createVenue | Hard block on exact normalized address match. Soft warning on normalized name match (strip all non-alphanumeric → "5Church" == "5 Church"). skipNameCheck param lets user bypass the warning after confirming "Proceed anyway." Address required server-side (not just client-side validation). normalizeAddress/normalizeName in src/lib/venues/normalize.ts with 12 unit tests. | Address-only check (missed name-only dupes) |
| 2026-06-03 | Lead/program unification (Path B): getLinkedProgramsByLeadId + board threading | One bulk query fetches Record<leadId, LinkedProgramSummary> for all programs with lead_id set. Threaded through LeadsPage → LeadsView → LeadsBoard → KanbanLane → LeadCard. Converted lead cards show a copper "→ Program Name" banner (clickable link to program, suppresses drag via onPointerDown stop). DragOverlay passes linkedProgram so the ghost card matches. | Per-card queries (N+1), separate board fetch |
| 2026-06-03 | syncProgramStatusFromLead fires on board drag (lead → program, one direction) | handleDragEnd: after updateLead, checks linkedPrograms[leadId] and calls syncProgramStatusFromLead(programId, newLeadStatus) in a startTransition. Maps 12 lead statuses → 3 program statuses (did_not_book/unresponsive/halted → did_not_book, completed → completed, else → active). | Sync on every field edit (too aggressive), WebSocket (overkill) |
| 2026-06-03 | Reverse status sync (program → lead, terminal states only) | updateProgramStatus uses UPDATE...SELECT('lead_id') to get lead_id in one round trip. If programStatus is completed or did_not_book, writes that status to leads. active → no-op (reverse is lossy). programStatusToLeadStatus() is a pure function in constants.ts with 6 unit tests. | Sync all states (completed ↔ lossy reverse); separate lookup query (extra round trip) |
| 2026-06-03 | "Create another program" removed — one lead, one program | Button gated inside linkedPrograms.length === 0 branch in LeadDetail so it is absent from the DOM when a program already exists. A genuine re-book is a new lead (enforced by migration 034 UNIQUE constraint on programs.lead_id). | Keep button with warning (confusing); allow multiple programs per lead |
| 2026-06-03 | Migration 034: UNIQUE constraint on programs.lead_id | Prevents multiple programs per lead at the DB level. Pre-checked 0 existing violations before applying. Re-books must start as a new lead. | Application-level check only (bypassable) |
| 2026-06-03 | Slide Copy module: Dianthus/Canva template format extensions | Max Capacity line appended to Slide 1 Header. New "Pricing Callout" block: "Starting at $X (based on N)" + "Including:" bullet list + price per person. Route/Itinerary optional free-text textarea → copy block (only shown when filled). Cost Summary replaces Estimate Summary: UPPERCASE labels, no Production Fee row, productionFeeTax in Tax, Admin Fee row. Menu format: HEADER (CHOOSE N) uppercase, needs_selection courses show ALL options (sample mode), spirit/bar course names auto-format as "VODKA / Tito's, Sobieski". Bar Notes free-text textarea appended as BAR section. Copy All filters empty sections. | Keep old padEnd column alignment (hard to paste into Canva) |
| 2026-06-03 | DbProgramSummary includes lead_id; ProgramsTable shows "← Lead" link | lead_id added to getPrograms() SELECT and map. Rows with lead_id show a small secondary "← Lead" link under the program name that navigates to the source lead. Doesn't add a new column — inline under the name. | New column (changes table layout); tooltip (less discoverable) |
| 2026-06-04 | program_type: nullable TEXT on programs, user-set dropdown, badge on card/list/detail | 7 values (Transportation, Staffing, Entertainment/Activations, Restaurants, Venues, Multi Category, Activations). updateProgramType() server action auto-saves in edit mode. ProgramsTable: type filter dropdown + inline badge. Kanban: badge on converted-program card (via LinkedProgramSummary). getProgram() now selects program_type. | PG enum (hard to extend); separate type table (overkill for 7 values) |
| 2026-06-04 | Onsite staffing tracker: program_staffing table (migration 036), StaffingSection component | per-role row with assigned_to (team_members dropdown), status enum (needs_staffing/assigned/confirmed), notes. Add/delete roles inline. Summary line "N of M confirmed · X need staffing." Staffing badge on programs list and Kanban. getStaffingForProgram() bulk query, staffing_needs_count on DbProgramSummary/LinkedProgramSummary. | Per-card N+1 queries (rejected — bulk map pattern); separate staffing page (too far from program context) |
| 2026-06-04 | 10-lane pipeline + tracking_on_hold/negotiations enum values + data remaps | Migration 035: ALTER TYPE adds tracking_on_hold + negotiations; UPDATE remaps halted→tracking_on_hold, planning/planning_not_started→under_contract. LeadStatusGroup loses 'paused' (now open/closed only). PIPELINE_LANES has 10 lanes with correct colors. Legacy values kept in type for DB compat but mapped to safe lanes. | Recreate enum (risky with existing data); split into separate migration per value (unnecessary) |
| 2026-06-04 | Tour estimate type — 4 phases, pure TS engine modules, JSONB detail storage | Phase 1: migration 037 (tour_details JSONB, estimate_type='tour'), TourEstimateBuilder shell. Phase 2: vehicleSizing.ts (suggestFleet, 4 candidate fleets, greeter logic). Phase 3: guideScaling.ts (waves, venue cap, self-guided), GuideSuggestionBanner + "Add as line item". Phase 4: tour_catalog table (migration 038), getTourCatalog/saveTourTemplate actions, Load/Save template UI, buildSummaryRows tour branch, ProposalDocument tourDetails logistics block. | Inline engine logic in component (untestable); separate tour DB tables (overkill for JSONB details) |
| 2026-06-04 | TourDetails extracted to src/lib/tours/types.ts (server-free) | ProposalDocument is dynamically imported client-side — can't safely use `import type` from a 'use server' file in all bundling contexts. Moving TourDetails + TourCatalogEntry to a plain TS file avoids this entirely. Pattern mirrors leads/constants.ts and programs/documentTypes.ts. | Keep in actions.ts (risky for dynamic imports); duplicate interface (drift) |
| 2026-06-07 | productionFeeTax included in export Tax row via + summary.productionFeeTax | When a new tax field is added to EstimateSummary, every tax aggregation site must be updated: buildSummaryRows, buildDetailedCopyText, buildClientExport, and the panel/PDF display. The engine computes correctly but export utilities are separate code paths. Fixed all four sites; dead-code buildClientExport fixed for future safety. | Omit from export utilities (itemized rows don't add up to total — invisible until caught by implied-rate tests) |
| 2026-06-07 | mathRates tax rate fields follow effectiveLocation pattern (override ?? locationDefault) | mathRates drives Show Math formula display; if it diverges from the engine's effectiveConfig, the formula shows a rate inconsistent with the computed dollar amount. The fix mirrors the effectiveLocation useMemo pattern already present in EstimateBuilder. | Use programConfig.location.* directly (shows wrong rate when override is set) |
| 2026-06-09 | Two-way venue sync: loop guard via spaceAutoFilledRef | Part 1 (space → estimate auto-fill) and Part 2 (estimate → vendor write-back) must not cycle. Stamping spaceAutoFilledRef.current.fbMinimum inside handleVenueAutoFill; handleFbMinimumWriteBack bails when isAutoFilled() returns true. Scenario A1 auto-saves when vendor is blank; A2 prompts when differing. Scenario B (no space selected, typed name) offers inline "Add space" card with capacity inputs. | No guard (infinite loop); always prompt (noisy for normal space selections) |
| 2026-06-09 | Budget compare_each per_person: compareEstimateToBudget branched on pricingBasis | compare_each with per_person basis should compare $/pp against the pp budget range, not total vs budget×guestCount. Added pricingBasis to EstimateVsBudget; per_person path uses pricePerPerson vs valueLow/valueHigh directly. combine mode unchanged (totals vs scaled budget is correct for a progress bar). | Keep single effectiveBudgetFlat path (wrong for per_person compare_each — confirmed by 6 failing tests) |

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
| 2026-05-05 | PM2 on Windows cannot use tsx as interpreter — silently crashes with no logs | Compile scanner to CJS first with `npm run build:scanner` (esbuild), then PM2 runs plain `node scripts/run-scanner.js`. |
| 2026-05-05 | `import 'dotenv/config'` in scanner resolves .env from process.cwd(), not the script dir | PM2 may not set cwd correctly. Use `dotenv.config({ path: path.resolve(__dirname, '..', '.env') })` for reliable resolution. |
| 2026-05-05 | Client component importing runtime values from queries.ts breaks the build | queries.ts imports server.ts (next/headers) — any runtime import in a client component pulls that chain in. Extract constants with no server deps into a separate file (src/lib/leads/constants.ts) and import from there instead. |
| 2026-06-03 | Client components must never import from queries.ts or server.ts | Both pull in next/headers, which is server-only. Build succeeds in dev (Next.js tolerates it) but fails on Vercel. Pattern: pass server data as props from the parent Server Component; use server actions for mutations; move shared types/constants to a server-free file (e.g. src/lib/programs/documentTypes.ts, src/lib/leads/constants.ts). queries.ts may re-export from these files for server-side callers. |
| 2026-05-05 | Migration 017 + 020 created parallel column sets for the same data | Migration 017 created source_advisor/source_coordinator/third_party_company/lead_source. Migration 020 added gdp_advisor/gdp_coordinator/third_party/lead_source_type as new columns. Both exist in DB. Scanner was writing to old, UI reading from new → data invisible in dropdowns. Fix: writer.ts explicitly maps new cols. Historical rows may need a one-time UPDATE backfill. |
| 2026-05-13 | Proposal validation EXPECTED_* values: manually computed via algebra, not by running engine | Engine subtotalClient INCLUDES vendor-side taxes (foodTaxOur etc.) per engine code. vendorCostsBase = subtotalOur - vendorTaxesTotal. ccProcessingAmount uses tax-inclusive subtotalClient. Algebraic verify: qcRevenue = markup + markupRevenue*clientComm - gdpComm - thirdParty. Get this wrong and test values look right but aren't. |
| 2026-05-28 | Synchronous export in 'use server' file causes Vercel build failure | Next.js enforces that all exports in a 'use server' module are async functions (server actions). A plain `export function` (non-async) triggers a build error. Any pure utility accidentally placed in actions.ts must be moved to a separate non-server file. |
| 2026-06-04 | Migration 038 failed with `function handle_updated_at() does not exist` | The trigger function in this DB is `update_updated_at()` (defined in migration 001), not `handle_updated_at()`. Used wrong name from memory. Always check existing migrations for the exact trigger function name before writing a new one. |
| 2026-06-02 | uploadLineItemThumbnail pointed at wrong bucket ('estimates' instead of 'line-item-thumbnails') | 'estimates' is the DB table name, not a storage bucket. The upload silently failed — Supabase returned an error but the server action swallowed it. Always verify bucket names in Storage dashboard before writing upload code. |
| 2026-06-02 | PDF section order was arbitrary — items sorted by item-level sort_order, not section-level | Array.from(new Set(lineItems.map(li => li.section))) gives section order from the first item of each section encountered. When multiple sections have items at sort_order 0, the output is unpredictable. Fix: pass orderedSections[] from each builder. |
| 2026-06-02 | PDF extraction silently capped at 5-10 items — prompt said "aim for 5-10 total" | Claude honored the instruction and deliberately skipped items on larger menus. The cap was a leftover from early development. Removed from prompt; max_tokens raised from 4096 to 16000. Always check extraction prompts for unintended quantity limits. |
| 2026-06-07 | productionFeeTax missing from export Tax row — Copy Numbers itemized rows didn't add up to total | Commit a0c096c added productionFeeTax to totalClient in the engine but did not update export.ts. The `tax` variable in buildSummaryRows and buildDetailedCopyText was missing `+ summary.productionFeeTax`. ProposalDocument.tsx was correctly updated at the time. Always update export.ts when adding new tax fields to EstimateSummary. |
| 2026-06-07 | mathRates in EstimateBuilder used raw location tax rates instead of effective (override) rates | effectiveLocation was computed correctly and passed to LineItemSection/ExportButtons, but mathRates (lines 366-368) still read programConfig.location.foodTaxRate etc. Show Math formula showed 7.25% while the dollar amount was computed at the 8.25% override — visually inconsistent. Fix: mirror effectiveLocation logic in mathRates. |
| 2026-06-09 | F&B break-even uses qty===guestCount heuristic to identify per-person items | No explicit per-person flag on line items — qty matching guestCount is the only reliable signal available at the pure-function level. Works correctly for typical estimates; breaks for items manually set to an amount that coincidentally equals guestCount. Noted in code comment. | Explicit isPerPerson flag (would require a new column + migration) |
| 2026-06-09 | Bar pricing: base_hours + additional_hour_price_per_person added as optional JSONB fields; existing price_per_person unchanged | JSONB extension means zero migration — old records parse fine (new fields absent = simple flat rate). computeBarPricePP() handles both shapes. | Rename price_per_person to base_price_per_person (breaks stored data); separate bar_pricing table (overkill for optional two-field extension) |
| 2026-06-09 | Budget compare_each per_person badge showed nonsense total-vs-pp delta | compareEstimateToBudget used effectiveBudgetFlat for both bases, comparing estimate total against budget×guestCount for per_person. Fix: branch on pricingBasis; per_person path compares pricePerPerson against raw valueLow/High/Pinned. target.guestCount is irrelevant for compare_each per_person — use the guestCount arg (from the event). |

## Current TODOs

### Completed ✓
- [x] Scaffold, Supabase setup, seed reference data, pricing engine (122 tests), admin panel, estimate builders, export, travel calculator, file attachments, auth, nav, PDF extraction, transportation builder, leads pipeline phases 1 & 2, inline editing, label field (see git log for full history)
- [x] team_members table (migration 019) — seeds 9 members, assigned_to on leads is now INTEGER FK to team_members(id)
- [x] Scanner owner lookup, dedup logic, backfill script, npm scripts cleanup
- [x] Scan Now button + POST /api/scanner/run
- [x] PM2 scanner: ecosystem.config.js uses interpreter pattern → compile step (build:scanner via esbuild) → plain node on compiled JS
- [x] Leads list: date range filter (From defaults 2026-01-01), Latest Scan / Earlier sections, default sort start_date asc
- [x] Archive Old bulk action (filters by start_date, sets did_not_book)
- [x] Leads pipeline overhaul (migration 020, run in prod): 12-value status enum, Open/Paused/Closed tabs, 13 new columns, 16-column horizontally-scrollable table, all dropdown cols inline-editable
- [x] Lead status constants extracted to src/lib/leads/constants.ts to fix client/server boundary build error
- [x] Leads list UX: dual-axis scroll (overflow-auto max-h-[calc(100vh-300px)]), sticky thead, frozen Client column, scan timestamp group labels, sticky section headers
- [x] ScanNowButton: router.refresh() after scan completes + 60s auto-poll with "Updated just now" indicator
- [x] Scanner writer: map source_advisor/source_coordinator/third_party_company/lead_source → gdp_advisor/gdp_coordinator/third_party/lead_source_type with dropdown normalization (matchOption, normalizeLeadSource)
- [x] Parser: updated Claude prompt to enumerate exact lead_source values and guide advisor/coordinator to first-name-only output
- [x] EventsView per-person price: uses event guest_count when set, falls back to program guest_count
- [x] buildLineItems in page.tsx: now applies markup_override per item (fixes card total mismatch vs live summary)
- [x] Copy Numbers venue export: Service Charge, Gratuity, Admin Fee now appear as separate rows (124 tests passing)
- [x] Leads list: replaced scan-batch grouping with flat start_date-sorted list; sort is universal (no isManual branch); NEW badge (copper pill, 24h rolling) inline next to client name; "N new today" toggle button in tab bar filters to recent leads
- [x] Revenue item flag (is_revenue_item): migration 021, isRevenueItem on LineItem/LocalLineItem, ourCost=0 in engine, "Rev/Rev ✓" toggle in LineItemRow — 5 new pricing tests (144 total)
- [x] Copy Numbers now exports per-item detail: item name, qty, unit price, our cost, client cost; section subtotals; then summary fees + total — 13 new export tests
- [x] Show Math toggle on all three builders: per-item formulas (our cost, markup, client cost), summary panel rate/base formulas, margin panel revenue/margin/true-net derivations
- [x] Margin formula fix: new formula (vendorCostsBase + taxes + CC + GDP + thirdParty + qcMargin = totalClient); 8 new tests (152 total); MarginPanel redesigned as waterfall with expandable Vendor Costs and Commissions sections
- [x] Tax column on all line item tables: shows rate + short location name (100px column); non-taxable items show "Non-taxable"
- [x] Program P&L panel: collapsible table on program page for all Include-in-Budget estimates; shows billing, vendor costs, taxes, commissions, QC margin, margin% with health colors; totals row at bottom
- [x] Guest count mismatch warning: amber ⚠ overlay on Qty input + banner above line items in all three builders (visual only, 172 tests passing)
- [x] Mobile responsive pass: MobileNav hamburger (layout.tsx), LeadsList card view (md:hidden), programs list/detail overflow fixes
- [x] Historical leads backfill migration: 022_backfill_migration_020_columns.sql — normalizes source_advisor/source_coordinator/third_party_company/lead_source → new 020 UI columns for existing rows
- [x] Proposal validation tests: tests/unit/proposal-validation.test.ts — 3 scenarios, 20 tests, engine-computed expected values with TODO markers for Excel verification
- [x] Migration 022 run in production — gdp_advisor, gdp_coordinator, third_party, lead_source_type backfilled for all historical leads
- [x] PM2 scanner deployed and confirmed working on Gary's PC — fires at 7am, 11am, 2pm, 4pm ET; logs show successful scans
- [x] Scan Now button confirmed working in production — Vercel env vars for Gmail and Anthropic are set
- [x] All leads features shipped: inline editing, lead detail, lead-to-program linking, status tabs, flat start_date sort, NEW badges, date range filter, archive old, delete, 60s auto-poll
- [x] Mobile responsive: hamburger nav, leads card view on mobile (<768px)
- [x] Client discount: migration 023, engine (discountAmount after all fees), UI toggle + input in all 3 builders, summary panels, margin panel Show Math — 10 new pricing tests (182 total)
- [x] PDF proposal export: @react-pdf/renderer, ProposalDocument component (header, metadata, line items by section, totals block), ExportButtons "Export Proposal PDF" button with dynamic import
- [x] Move line items between categories: checkboxes on rows, action bar with section dropdown, SECTION_DEFAULT_TAX for taxType update on move — all 3 builders
- [x] Migration 023 run in production — discount_type + discount_value columns live
- [x] Bulk "Set Markup %" action bar — applies same markup % to all selected line items at once (all 3 builders)
- [x] Production Fee tooltip — info (i) badge with CSS-only hover tooltip showing the formula
- [x] Select-all checkbox — per-section header checkbox with indeterminate state support (all 3 builders)
- [x] Staffing & Fees section in Decor builder — Non-Taxable Staffing bucket wired in
- [x] Engine refactor — TaxBucket enum (fb/equipment/venue/staffing) replaces section-string matching; 5 new routing tests (194 total)
- [x] Dynamic estimate sections (#2/#3/#4) — migration 025, estimate_sections table, per-estimate sections, inline rename (pencil icon), delete empty sections, Add Category button with name+bucket picker; all 3 builders; 0 TypeScript errors, 194 tests passing
- [x] Migration 025 run in production — estimate_sections table + section_id FK on estimate_line_items live
- [x] Bug #5 fix — GDP commission base corrected to totalClient; clientCommission deducted from QC margin; 199 tests passing

- [x] Slide Copy Module — all 5 phases (migration 026, brand voice, travel, menu selection, venue bio, formatted preview); 225 tests passing
  - Phase 1: Types (slideCopy.ts), brandVoice.ts (20 tests), travel.ts (30 tests), migration 026, saveSlideCopyData action, SlideCopySection wired into venue EstimateBuilder
  - Phase 2: getTravelTime server action (Google Maps Distance Matrix API, traffic multipliers, planning notes, DriveTimeBlock UI)
  - Phase 3: Enhanced extraction pipeline (dietary tags, selection rules, maxSelections), MenuSelectionPanel, "Copy to Canva" Option B (pendingMenuData state + slideCopyRef scroll)
  - Phase 4: generateVenueBio server action (URL fetch + Claude API, name-based fallback), VenueBioBlock UI (editable textarea, Generate button)
  - Phase 5: Formatted preview mode (Slide1Preview + Slide2Preview, 16:9 ratio, brand colors, Cormorant Garamond + Playfair Display, toggle button); note alerts Alex about Bright Darling substitute
- [x] Migration 026 run in production — slide_copy_data JSONB column live
- [x] Drag-and-drop reordering — dnd-kit, SortableSectionItem render prop, SortableItemRow in LineItemSection; reorderSections + reorderLineItems server actions; all 3 builders; persists to DB via sort_order column (migration 025)
- [x] Vercel build fix — extractedMenuToMenuCourses moved from actions.ts to src/lib/slideCopy/menuMapping.ts (synchronous exports not allowed in 'use server' files)
- [x] Summary panel labels dynamically derived from live section names (sectionLabels.ts helper, labelForBucket); DecorSummaryPanel uses per-section totals instead of hardcoded Floral/Rentals split; SlideCopySection summaryRow labels also derived from sections; 5 new sectionLabels tests (230 total)
- [x] Production fee taxed at general sales rate — new EstimateSummary fields: productionFeeTax, lineItemsSubtotalClient, preTaxTotal; calculateMarginAnalysis.totalTaxes includes productionFeeTax; all summary panels (Venue/AV/Decor) show new format Subtotal→Production Fee→Pre-Tax Total→Tax→Total; PDF updated; 7 new tests + updated expected values (237 total)
- [x] Google Maps travel time: better error messages (key-absent vs API-error), fetchMapsDistance logs failures to server, try/catch around server action call in SlideCopySection
- [x] Merge duplicate leads/programs: checkboxes on leads table and programs table; MergeLeadsDialog and MergeProgramsDialog show side-by-side field comparison (most recently updated is default survivor, radio buttons per differing field, confirmation step); mergeLeads re-points linked programs; mergePrograms moves estimates+events to survivor; LeadRow refactored into LeadRowCells
- [x] Line item thumbnails: migration 027 (thumbnail_url, thumbnail_icon on estimate_line_items); ThumbnailCell component with Lucide icon picker (18 icons) and Supabase Storage photo upload; client-side suggestIcon() keyword matcher; display in all 3 builders; PDF shows uploaded photos; lucide-react installed
- [x] Travel time: free-form From/To address inputs replace locked client_hotel/venue fields; values persist in slide_copy_data; Google Maps billing activated, Distance Matrix API enabled — travel time working in production
- [x] PDF section order fix: builders pass orderedSections[] (sorted by estimate_sections.sort_order) through ExportButtons to ProposalDocument; user drag-and-drop order now preserved in PDF
- [x] PDF extraction fixes: removed "aim for 5–10 total" cap from venue prompt; raised max_tokens from 4096 to 16000 on both extraction paths
- [x] Package options for PDF menu extraction (migration 028): packageOptions JSONB + selected_package_id on estimate_line_items; Claude detects Package A/B/C groups and returns as single line item; PackageSelector accordion UI with radio buttons; selecting a package sets unitPrice; PDF shows selected package name + dishes; Slide 2 "Sync from selections" button; 14 new tests (251 total)

### Remaining
- [x] Migration 027 run in production — thumbnail_url + thumbnail_icon columns live
- [x] Migration 028 run in production — package_options + selected_package_id columns live
- [x] Program lifecycle status (migration 029, Active/Completed/Did Not Book tabs, inline dropdown, detail page dropdown, archived_at)
- [x] Venue force-address: required banner in EstimateBuilder, inline "Add new venue" form with duplicate check, auto-suggest tax location banner
- [x] Venue profile: program history + attachments section on venue detail page
- [x] Venues list: Programs and Files count columns added
- [x] Migration 029 run in production — status + archived_at columns live
- [x] Migration 034 run in production — UNIQUE constraint on programs.lead_id live
- [x] Lead/program unification (Path B): getLinkedProgramsByLeadId, board threading, converted-lead banner, syncProgramStatusFromLead on drag, program page "← Lead" link, "Create another program" removed
- [x] Slide Copy: Dianthus/Canva template format — pricing callout, max capacity, itinerary field, bar notes, cost summary uppercase, menu choice headers + sample mode, Copy All filters empties
- [x] Reverse status sync (program → lead, terminal states only): updateProgramStatus back-propagates completed/did_not_book to lead.status; programStatusToLeadStatus() with 6 unit tests (330 total, 13 files)
- [x] DragOverlay cosmetic fix: linkedProgram passed to LeadCardContent so ghost card shows program banner during drag
- [x] Programs list lead_id: DbProgramSummary extended, getPrograms() selects lead_id, "← Lead" link on lead-sourced rows
- [x] 10-lane pipeline overhaul (migration 035): tracking_on_hold + negotiations added to enum; halted→tracking_on_hold, planning/planning_not_started→under_contract remapped; Paused tab removed; LeadStatusGroup = open|closed; PIPELINE_LANES updated; LeadDetail/LeadStatusBadge updated; 41 pipeline tests passing
- [x] Status dropdown always visible on every Kanban card (removed laneStatuses.length > 1 guard)
- [x] program_type: TEXT NULL on programs (migration 035); PROGRAM_TYPES constant; dropdown in ProgramForm (create + auto-save edit); updateProgramType() action; badge on program detail header, programs list rows, Kanban converted-program cards; type filter dropdown on programs list
- [x] Onsite staffing tracker (migration 036): program_staffing table, staffing_status enum; getStaffingForProgram(); addStaffingRole/updateStaffingRole/deleteStaffingRole actions; StaffingSection client component; program detail page wires staffing + team members; staffing_needs_count on DbProgramSummary + LinkedProgramSummary (bulk query); staffing badge on programs list + Kanban cards; 339 tests passing

### Remaining
- [x] Migrations 035 and 036 run in production — enum values live, data remapped, program_staffing table created
- [x] Tour estimate type — all 4 phases complete (migrations 037 + 038, vehicleSizing, guideScaling, catalog, PDF; 403 tests passing)
- [x] Migration 038 run in production — `tour_catalog` table live
- [x] Bug fix: productionFeeTax missing from Copy Numbers Tax row (buildSummaryRows + buildDetailedCopyText in export.ts + dead-code buildClientExport in pricing.ts); 5 new export tests; 408 total
- [x] Bug fix: SummaryPanel Show Math displayed location default tax rate instead of override rate when overrides set; mathRates now mirrors effectiveLocation pattern; 4 new implied-rate tests; 412 total
- [x] Coverage audit: 14 calculation areas rated SOLID/THIN/NONE; 24 new tests closing highest-risk gaps (third-party commissions, production fee dollar, all 11 markup categories, row-sum export guard, pricePerPerson rounding); 436 total
- [x] Budget Plan feature — all 4 phases complete (migration 040, reverseCalculateBudgetTargetRange, estimate sandbox pre-fill + Apply button, calculateBudgetRollup + rollup table); 508 tests passing
- [x] Migration 039 run in production — Washington DC city normalization backfill live
- [x] Migration 040 run in production — budget_plan_entries table live
- [x] Vendor directory Phase 1 (database + directory UI): migration 041 (vendor_type enum, contact_title, email_signature, market on venues; privacy_tag on venue_spaces); VendorsList with type tabs + CopyEmailSigButton + TypeBadge; VenueForm + SpacesManager updated; picker filtered to venue+restaurant; 508 tests, 0 TS errors
- [x] Migration 041 run in production — vendor_type, contact_title, email_signature, market columns + space privacy_tag; re-tags known restaurants
- [ ] **Venue profile data** — need real estimates with `venue_id` set to verify history section populates. Trigger by opening an existing venue estimate, selecting a venue, then visiting the vendor profile.
- [ ] **Tell Alex** — Bright Darling is not on Google Fonts; Cormorant Garamond is used in the Slide Copy preview instead; she should swap to Bright Darling in the actual Canva template
- [ ] **Validate proposal-validation.test.ts against Excel** — enter the 3 scenarios from tests/unit/proposal-validation.test.ts into QC_Estimate_Template_2026.xlsx and compare EXPECTED_* values; update if engine has bugs (note: EXPECTED_QC_MARGIN values changed significantly with bug #5 fix and again with production fee tax)
- [ ] Venue profile: attachment download links (currently shows filename only — needs signed URL for clickable download)
- [ ] Role-based access — admin vs user distinction exists in DB but UI enforcement is minimal
- [x] Document Extractor (Doc Reader): utility page at /document-extractor; pdfImages.ts + docxExtract.ts utility libs + 21 unit tests; POST /api/document-extractor/text (Claude vision/text, model selector); POST /api/document-extractor/images (deterministic byte-scan PDF, word/media DOCX unzip); DocumentExtractorClient.tsx (drop zone, model picker, text sections + Copy, image grid + per-image download + Download All zip); nav link; 539 tests passing
- [x] normalizeName strengthened: NFD diacritics, &/+ → and connector canonicalization; 10 new unit tests; display names never modified
- [x] Six small improvements: Incentive program type, Drink Tickets/On Consumption alcohol types, inline location create from estimate page, proposal due date on Kanban cards (red/amber urgency), + Add Lead on board view, markets reference table (migration 043, dropdown with inline add in VenueForm)
- [x] Migration 043 run in production — markets table seeded from existing venue.market values
- [x] Estimate snapshot bar: compact read-only strip (event date, timing, guests, budget) at top of all 5 builders; EstimateSnapshotBar component; budgetPlanEntry + event props threaded to all builders
- [x] Budget comparison on event cards (migration 044): budgetComparison.ts engine (36 tests); compare_each mode shows per-card ±$delta badge; combine mode shows progress bar + remaining/over; mode toggle persists to DB; EventRow carries budgetEntry
- [x] Migration 044 run in production — comparison_mode column live on budget_plan_entries
- [x] Vendor merge: mergeVendors server action (repoints estimates.venue_id, venue_spaces.venue_id, vendor_photos.vendor_id; JSONB precedence; duplicate space detection; delete loser after all repointing); mergeLogic.ts pure functions + 22 unit tests; MergeModal UI with side-by-side comparison + survivor picker + "MERGE" confirmation
- [x] Vendor mass actions: per-row checkboxes + select-all (within filter/tab), bulk action bar with "Set type" dropdown + "Set market" dropdown (from markets table); bulkUpdateVendors server action; optimistic clear + router.refresh; 657 tests passing
- [x] Doc Reader pipeline — all 3 steps complete (678 tests passing, 0 TS errors):
  - Step 1: extractedVendorTypes.ts (ExtractedVendorProfile, normalizeExtractedProfile), POST /api/document-extractor/vendor (structured JSON extraction, max_tokens 16000)
  - Step 2: applyVendorExtraction server action (basics/spaces/menus/bar_options/inclusions with per-section checkboxes); VendorExtractionReview UI (create/update modes, diff view, duplicate handling); DocumentExtractorClient vendor mode toggle
  - Step 3: menuImport.ts (mapMenuToLineItems, 21 tests); VendorMenuImportModal (two-panel picker); EstimateBuilder "Add from vendor menu" button + handleAddFromVendorMenu (routes through handleImportItems — normal markup/tax apply, never automatic)

- [x] F&B minimum break-even guest count: calculateFbBreakEven() pure function (fbMinimumThreshold.ts, 14 tests); SummaryPanel shows "Needs N+ guests" / "Met at N+ guests ✓"; EstimateBuilder computes via useMemo from F&B line items; 692 total tests
- [x] Bar packages: base duration + additional hours pricing on BarOption (base_hours, additional_hour_price_per_person); computeBarPricePP() helper; BarEditor 3-field row (Base $/pp / Base hrs / +hr $/pp); VendorBrochure renders "X/pp first N hours, +Y/pp/hr"; VendorMenuImportModal adds "Bar packages" tab with multi-select + duration input + live computed rate; EstimateBuilder handleAddBarPackages routes through handleImportItems (alcohol taxType, F&B section); SlideCopySection bar import shows inline duration field, passes duration to vendorBarToBarNotes; backward-compatible JSONB — existing packages keep working. 12 new tests (704 total)
- [x] Two-way venue ↔ estimate sync: venueSync.ts pure helpers (classifySpaceSync, findMatchingSpace, isAutoFilled, 24 tests); loop guard (spaceAutoFilledRef); Scenario A1 auto-saves fbMinimum to blank vendor space + toast; Scenario A2 amber prompt for differing values; Scenario B inline "Add space" offer with capacity inputs when room space doesn't match any known space. 728 tests.
- [x] Bug fix: budget compare_each per_person basis was comparing estimate total vs budget×guestCount (not pp vs pp). compareEstimateToBudget now branches on pricingBasis: per_person compares pricePerPerson against valueLow/valueHigh directly, delta is in $/pp; flat unchanged. Badge shows "+$2/pp vs budget". 6 failing tests confirmed bug; 733 tests passing.

### Next Session Start
- All migrations through 044 are live in production. 733 tests passing.
- Two-way venue sync and budget comparison fix both live (pushed to main).
- Tell Alex about the Bright Darling substitute (Cormorant Garamond in Slide Copy preview; she swaps in Canva).
- Venue profile attachment downloads: signed URL generation is the next small task.
- Proposal validation against Excel is the next quality check — enter the 3 scenarios from proposal-validation.test.ts into QC_Estimate_Template_2026.xlsx and compare EXPECTED_* values.

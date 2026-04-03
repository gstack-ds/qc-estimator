# PRD: QC Estimator

## Document Info
- **Author:** Gary Stack
- **Created:** 2026-04-03
- **Status:** Draft
- **Last Updated:** 2026-04-03
- **Research Brief:** research-brief-qc-proposal-builder.md (completed 2026-04-03)

---

## Problem Statement

QC Event Design prices corporate events using a 30+ tab Excel workbook where each tab duplicates the same pricing calculator with different venue/vendor inputs. This creates formula drift risk, makes tax rate and markup updates error-prone (must update every tab), provides no multi-user access, has no audit trail, and forces a non-technical team to navigate complex spreadsheet architecture. The team needs a web-based tool that centralizes reference data, automates the pricing math, supports multi-scenario comparison, and exports clean numbers for their Canva proposal workflow.

## Target User

**Primary:** QC Event Design's internal team (3-5 non-technical event planning professionals)
- They price corporate events (galas, conferences, leadership summits, private dining)
- They compare multiple venue options for the same event
- They need to manage tax rates, markups, and commissions without SQL or formulas
- They export pricing numbers into Canva for client-facing proposals
- They are comfortable with Excel but not with database UIs or developer tools
- They work under time pressure — events have hard deadlines

**Secondary:** Gary Stack (builder and system administrator)

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Team adoption | 100% of new proposals built in the app (not Excel) within 60 days of launch | Count proposals created in app vs. Excel |
| Pricing accuracy | 0 calculation errors across first 20 proposals | Compare app output to manual verification |
| Time to estimate | <15 minutes per venue scenario (currently ~25-30 min in Excel) | Self-reported by team |
| Admin self-service | 0 Gary-assisted tax/markup changes after initial training | Track support requests |
| Data consistency | Single source of truth — no duplicate rate tables | Audit reference data tables |

---

## Competitive Landscape

**Curate** (~$100+/month): Closest competitor. Uses cost × markup model. Good proposal builder with e-signatures and payments. Does NOT support county-level tri-rate taxes, 11 category markups, multi-scenario venue comparison, restaurant fee layering (service charge + gratuity + admin fee), internal margin analysis, or travel expense calculation. Recent forced platform migration broke customer proposals mid-season — negative reviews across Capterra, G2, GetApp. 90% of users are florists, not corporate event planners.

**Planning Pod** (~$49-99/month): Venue management focus. No pricing engine with category markups or margin analysis.

**Airtable / Notion**: Can store reference data but can't handle the multi-step pricing calculation (markups → taxes → restaurant fees → commissions → production fee).

**Excel (current state)**: Maximum flexibility, zero guardrails. The 30-tab duplication problem is the direct pain point.

**Gap:** No tool supports QC's specific workflow of county-level tri-rate taxes × 11 category markups × restaurant fee structures × commission layers × travel expenses × margin analysis × multi-scenario comparison — usable by non-technical staff.

---

## MVP Scope — What's In (Phase 1)

### Feature 1: Program Setup
- **Description:** Create a new program (top-level container for an event). Captures event details, selects location (which auto-populates tax rates), sets commission rules, and optionally assigns a client.
- **User story:** As an event planner, I want to create a new program with event details so that all estimates for this event share the same configuration.
- **Acceptance criteria:**
  - [ ] Can create a program with: program name, client name (optional), event date, guest count, service style, alcohol type, event time, company name, client hotel
  - [ ] Can select location from dropdown — food, alcohol, and general tax rates auto-populate
  - [ ] Can set category markups (defaults from config, overridable per program)
  - [ ] Can set CC processing fee %, client commission %, GDP commission toggle
  - [ ] Can set restaurant fee defaults (service charge, gratuity, admin fee)
  - [ ] Client name is nullable — program can be created without one and assigned later
  - [ ] All fields auto-save on change
- **Priority:** Must-have

### Feature 2: Venue Estimate Builder
- **Description:** Create venue/restaurant estimates within a program. Each estimate has line items grouped by tax category, with automatic pricing calculations. Multiple estimates serve as scenarios for comparison.
- **User story:** As an event planner, I want to build a pricing estimate for a specific restaurant so I can see what this venue option would cost the client.
- **Acceptance criteria:**
  - [ ] Can create multiple estimates per program (each is a venue/restaurant option)
  - [ ] Can name each estimate (e.g., "The Belmond — Ballroom")
  - [ ] Can add venue-specific details: venue name, room/space, F&B minimum, is venue rental taxable toggle
  - [ ] Can override restaurant fee defaults per venue (service charge, gratuity, admin fee)
  - [ ] Line items organized in sections: F&B (food tax), Taxable Equipment/Staffing (general tax), Venue Fees (general tax if taxable), Non-Taxable Staffing
  - [ ] Each line item has: name, qty, unit price, category (dropdown from 11 categories), auto-calculated our cost and client cost
  - [ ] Client cost = our cost × (1 + category markup %)
  - [ ] Tax auto-applied based on section and location
  - [ ] Service charge, gratuity, admin fee calculated on F&B subtotal
  - [ ] Production fee calculated per Excel formula
  - [ ] Summary section shows: F&B subtotal, food tax, alcohol tax, equipment subtotal, equipment tax, QC staffing subtotal, venue subtotal, venue tax, service charge, gratuity, admin fee, subtotal, production fee, total estimate
  - [ ] Price per person auto-calculated (total / guest count, rounded up)
  - [ ] F&B minimum status indicator (met / not met with shortfall amount)
- **Priority:** Must-have

### Feature 3: Scenario Comparison
- **Description:** View all estimates for a program side-by-side to compare venue options.
- **User story:** As an event planner, I want to compare pricing across multiple venue options so I can advise the client on the best value.
- **Acceptance criteria:**
  - [ ] Shows all estimates for a program in a comparison grid
  - [ ] Each card shows: venue name, total estimate, price per person, line item count
  - [ ] Lowest cost option highlighted
  - [ ] Can toggle estimates on/off for a "Total Budget" combined view
  - [ ] Total Budget shows combined total of all toggled-on estimates
- **Priority:** Must-have

### Feature 4: Margin Analysis
- **Description:** Internal-only view showing QC's profit margins on each estimate.
- **User story:** As an event planner, I want to see our margins on each venue option so I can ensure we're pricing profitably.
- **Acceptance criteria:**
  - [ ] Shows: client commission, GDP commission, total vendor costs, QC revenue, QC margin %
  - [ ] Margin health indicator: ✓ Strong (≥35%), → On Target (≥28%), ⚠ Review (≥22%), ✗ Below Floor (<22%)
  - [ ] Shows estimated team hours (from revenue lookup table) and OpEx estimate (hours × $90)
  - [ ] Shows true net profit (QC revenue - OpEx - travel)
  - [ ] True net health indicator: ✓ Strong (≥15%), → On Target (≥7%), ⚠ Thin (≥0%), ✗ Losing Money (<0%)
  - [ ] This section is NEVER visible in exports — internal only
- **Priority:** Must-have

### Feature 5: Admin Panel — Reference Data Management
- **Description:** Editable tables for all reference data, accessible to the team without SQL.
- **User story:** As a team member, I want to update tax rates and markup percentages myself when they change, without asking Gary.
- **Acceptance criteria:**
  - [ ] Editable table for locations (county/city name, food tax %, alcohol tax %, general tax %, effective date)
  - [ ] Editable table for category markups (category name, markup %, notes)
  - [ ] Editable table for commission config (CC processing %, default client commission %, GDP rate, third-party commissions)
  - [ ] Editable table for team hours tiers (revenue threshold, base hours, tier name)
  - [ ] Can add, edit, and delete rows in all tables
  - [ ] Inline cell editing (click to edit, like a spreadsheet)
  - [ ] Add row button and delete button per row
  - [ ] Confirmation dialog on delete
  - [ ] Changes auto-save
  - [ ] Shows "last updated" timestamp on each table
- **Priority:** Must-have

### Feature 6: Export for Canva
- **Description:** Export pricing data in formats the team can use in their Canva proposal workflow.
- **User story:** As an event planner, I want to copy pricing numbers so I can paste them into our Canva proposal template.
- **Acceptance criteria:**
  - [ ] "Copy Numbers" button copies a formatted per-person breakdown table to clipboard (menu, bar, staffing, equipment, venue, production fee, tax, total — with amounts and per-person prices)
  - [ ] "Export to Excel" button downloads an .xlsx with all estimates as separate tabs
  - [ ] "Export to CSV" button downloads a flat CSV of line items
  - [ ] Export shows client-facing numbers only — no cost, markup %, or margin data
  - [ ] Per-person prices calculated as client cost / guest count
- **Priority:** Must-have

### Feature 7: Authentication
- **Description:** Simple auth so only the QC team can access the tool.
- **User story:** As a team member, I want to log in so that our pricing data is secure.
- **Acceptance criteria:**
  - [ ] Supabase Auth with email/password
  - [ ] No public signup — Gary creates accounts manually or via invite link
  - [ ] Session persists across browser closes
  - [ ] RLS on all tables — authenticated users only
- **Priority:** Must-have

### Feature 8: Dashboard
- **Description:** Landing page showing recent programs with status.
- **User story:** As a team member, I want to see all programs at a glance so I can find and resume my work.
- **Acceptance criteria:**
  - [ ] Shows list of all programs sorted by most recently updated
  - [ ] Each row shows: program name, client (or "No client yet"), number of estimates, date created, last updated
  - [ ] Click to open a program
  - [ ] "New Program" button
  - [ ] Search/filter by program name or client
- **Priority:** Must-have

---

## MVP Scope — What's NOT In (Deferred)

| Feature | Deferred To | Reason |
|---------|-------------|--------|
| AV Estimate type | Phase 2 | Different line item structure. Core pricing engine is the same — just needs a different form layout. |
| Decor Estimate type | Phase 2 | Same as AV — different sections (Florals, Rentals & Lounge, Rugs & Accessories) but same engine. |
| Travel Expense Calculator | Phase 3 | Significant logic (drive/train/flight lookups, hotel rates, per diem, vehicles). Self-contained module that doesn't block core pricing. |
| Travel rate reference tables (admin) | Phase 3 | Only needed when travel calculator is built. |
| Client-facing proposal generation | Never | They use Canva. The app is internal-only. |
| Payment collection | Never | Handled separately. |
| Contract management | Never | Out of scope — use Curate or another tool if needed. |
| Event timeline / day-of logistics | Never | Not a pricing concern. |
| Client portal | Never | Clients never see this tool. |
| PDF proposal export | Phase 2 | Nice-to-have for internal review, but Canva is the client deliverable. |
| Mobile-optimized UI | Phase 2 | Desktop/tablet first. Data entry on a phone is painful. |
| Multi-company support | Never (unless productized) | This is a single-company tool. |
| Historical analytics / reporting | Phase 4 | "What's our average margin by category" — valuable but not MVP. |

---

## Technical Approach

### Tech Stack
- **Framework:** Next.js 14+ (App Router, Server Components, Server Actions)
- **Language:** TypeScript (strict mode)
- **Database:** Supabase (Postgres)
- **Auth:** Supabase Auth (email/password)
- **Styling:** Tailwind CSS
- **Testing:** Vitest
- **Deployment:** Vercel
- **Export:** xlsx library for Excel, native Clipboard API for copy

### Architecture

```
Browser → Next.js App Router → Server Actions → Supabase (Postgres)
                                    ↓
                            Pricing Engine (pure TS)
                                    ↓
                            Calculated Results → UI
```

The pricing engine is a pure TypeScript module with no framework dependencies. It takes structured inputs (line items, tax rates, markups, fee config) and returns calculated results (subtotals, taxes, fees, totals, margins). The engine is called both server-side (for data persistence) and client-side (for real-time UI updates as users edit inputs).

### Database Schema (key tables)

**programs** — id, name, client_name (nullable), event_date, guest_count, service_style, alcohol_type, event_time, company_name, program_name, client_hotel, location_id (FK), cc_processing_fee, client_commission, gdp_commission_enabled, service_charge_default, gratuity_default, admin_fee_default, created_at, updated_at, created_by

**estimates** — id, program_id (FK), type (venue/av/decor), name, room_space, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override, include_in_budget, sort_order, created_at, updated_at

**estimate_line_items** — id, estimate_id (FK), section, name, qty, unit_price, category_id (FK), tax_type (food/alcohol/general/none), notes, sort_order

**locations** — id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate, effective_date

**category_markups** — id, name, markup_pct, notes, sort_order

**team_hours_tiers** — id, revenue_threshold, base_hours, tier_name

**commission_configs** — id, program_id (FK, nullable for defaults), name, rate, type (flat/percentage)

### Data Sources
All seed data extracted from the Client Setup tab of QC_Estimate_Template_2026.xlsx:
- 22 locations with tri-rate tax data
- 11 category markups
- Drive routes, train routes, flight types (Phase 3)
- Hotel rates, per diem rates, vehicle rates (Phase 3)
- Team hours tiers (14 rows)

---

## Phase Plan

| Phase | Description | Features | Timeline | Status |
|-------|-------------|----------|----------|--------|
| 1 | Core Pricing Engine | Program setup, venue estimates, pricing engine, margin analysis, admin panel, export, auth, dashboard | 2-3 weekends | Not Started |
| 2 | Additional Estimate Types | AV estimates, Decor estimates, total budget toggle view, PDF export | 1-2 weekends | Not Started |
| 3 | Travel Calculator | Full trip calculator with all rate lookups, travel admin tables | 1-2 weekends | Not Started |
| 4 | Polish & Analytics | Historical reporting, margin trends by category, UX refinements | 1 weekend | Not Started |

---

## Risks & Mitigations

| Risk | Category | Severity | Likelihood | Mitigation |
|------|----------|----------|------------|------------|
| Team won't adopt — comfortable with Excel | Adoption | HIGH | MEDIUM | Mirror spreadsheet UX. Run parallel for 2-3 programs. Wife mandates the switch. |
| Gary becomes permanent IT support | Maintenance | HIGH | HIGH | Admin panel for self-service. User guide. Defensive error handling. |
| Formula drift — app vs spreadsheet numbers don't match | Data Integrity | MEDIUM | HIGH | Validate against 3-5 real proposals before launch. 100% test coverage on pricing engine. |
| Scope creep into event management | Scope | MEDIUM | MEDIUM | "What's NOT In" section above. Stay disciplined. |
| Tax rates go stale | Data Quality | MEDIUM | MEDIUM | Effective date field. Visual indicator for rates >12 months old. |
| Gary's bandwidth (work, school, family, baby in Nov) | Personal | MEDIUM | HIGH | Phase 1 only. Ship venue estimates first, validate, then decide on Phase 2. |
| Supabase free tier limitations | Technical | HIGH | LOW | Use Pro tier ($25/mo) for daily backups. Business-critical data. |

---

## Open Questions

1. **Project name** — `qc-estimator`? `qc-pricing`? Confirm before creating the repo.
2. **Custom line items** — should the estimate builder support "custom" line items that bypass the category markup (team enters both cost and client price manually)? Research brief recommends this as an escape hatch.
3. **Estimate duplication** — should users be able to duplicate an estimate (clone all line items to a new scenario)? Common Excel workflow is to duplicate a tab and modify.
4. **Historical proposals** — should we import any existing Excel proposals for validation, or just use the template structure?
5. **Supabase project** — create a new Supabase project or reuse an existing one?
6. **Domain** — deploy to qc-estimator.vercel.app or a custom domain?

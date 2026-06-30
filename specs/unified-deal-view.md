# Unified Deal View — Design & Build Spec

**Goal:** One scrollable page that assembles a lead + its converted program (and the shared
client) into a single "deal" record, so Alex stops toggling between the separate `/leads/[id]`
and `/programs/[id]` pages for one client. Built on the Phase-1 `clients` table + `client_id`
links.

## Locked decisions
1. **Spine = `client_id`.** A deal = one `client_id`. Covers all 3 shapes: lone lead,
   lead+program pair, standalone program. (`lead_id` couldn't unify the 30 lead-less programs.)
2. **Route = new `/deals/[id]`** where `[id]` is the client_id. Old `/leads/[id]` and the
   program *detail* page `/programs/[id]` redirect in with anchors. Deep tool sub-routes
   (estimate builder, budget builder) stay put.
3. **Layout = ONE sectioned page, NOT tabs.** Tabs would recreate the toggling pain. Everything
   visible/scrollable; breadcrumb crumbs are in-page anchor jumps.
4. **Status = swappable** (FULL 14-stage vs SIMPLE 5–6 stage) — pending Alex. Stored status
   unchanged (`lead.status` stays the 14-value enum); the program's 3-state becomes a derived
   shadow. Display is a config-driven component so we flip ONE constant when Alex decides.

## Data assembly (`getDealByClientId`)
```
client  = clients   WHERE id = :clientId          (the shared identity/commission anchor)
lead    = leads     WHERE client_id = :clientId    (0 or 1, newest)
program = programs  WHERE client_id = :clientId    (0 or 1, newest)
```
| Shape | lead | program | Renders |
|---|---|---|---|
| Lone lead (170) | ✓ | ✗ | client + lead sections; program sections show "Not booked yet — Create workspace" |
| Pair (11) | ✓ | ✓ | everything |
| Standalone program (30) | ✗ | ✓ | client + program sections; lead area collapses to "No lead record (direct booking)" |

## Page section order (top → bottom = lifecycle)
0. Sticky header + status bar (deal name, client/company, owner/team, swappable status, breadcrumb row)
1. Client & Deal Info *(clients)* — edited once here
2. Intake & Source *(lead)*
3. Dates & Logistics *(lead)*
4. Program Setup *(program; empty-state CTA when none)*
5. Events & Estimates *(program — EventsView; each event name is its own jump anchor)*
6. Staffing *(program)*
7. Budget Plan + Responses *(program)*
8. Onsite Brief *(program, status active)*
9. Callouts *(program)*
10. Financials / P&L *(program)*
11. Documents *(lead email + program docs)*
12. Danger zone

Existing display components reused as-is (EventsView, StaffingSection, BudgetPlanSection,
ProgramPnLPanel, lead field groups). Composition, not rewrite.

## Breadcrumb-jump navigation (in-page)
Sticky sub-header: `Programs › Deal Name › [Client] [Intake] [Events] · {event names} · [Staffing] [Budget]`.
- "Programs" → leaves to the programs/pipeline list.
- Deal name → scroll to top.
- Section / event crumbs → `scrollIntoView` on that section's `id`. Event crumbs generated from `events[]`.
- IntersectionObserver highlights the in-view section's crumb.

## Estimate ↔ venue round-trip
A `returnTo` query param threaded through the venue-edit flow so editing a venue from inside an
estimate returns to the *estimate*, not the deal top. Deal → estimate carries
`?returnTo=/deals/[id]#events`; estimate → venue carries `?returnTo=/programs/[id]/estimates/[estId]`.
On save/back, push `returnTo` (fallback to existing back behavior if absent).

## Status display (swappable, no data change)
`<StatusProgression value={lead.status} config={ACTIVE_CONFIG} />`. `ACTIVE_CONFIG` is one
import: `FULL_STAGES` (14, 1:1) or `SIMPLE_STAGES` (5–6 buckets). `lead.status` becomes
authoritative; `program.status` derives from it (repoint the few readers: programs-list tabs,
`archived_at`, brief-active gate, budget-response routing).

## Boards (related decision — deferred to 2F)
Recommendation: Leads Kanban → single Pipeline board over all deals; Programs list → a
Financials lens; both link to `/deals/[id]`. Deferred until the detail page proves out and
Alex picks status granularity.

## Phased build plan
| Phase | Scope | Done criteria |
|---|---|---|
| **2A — activate client_id write path** ✅ | Every new lead → own client+link; convert reuses the lead's client (one client, not two); standalone program → own client; `getDealByClientId` assembly query. Additive, no UI, existing 211 untouched. | New lead gets client_id; convert shares the SAME client_id; standalone gets its own; existing records unchanged; `getDealByClientId` returns all 3 shapes. |
| **2B — read-only deal page** | `/deals/[clientId]`, all sections read-only (reuse components), swappable StatusProgression (default FULL), sticky header + breadcrumb jumps, all 3 shapes. No edits/redirects (temp link). | Visit lone lead / pair / standalone — all sections render; jumps work. |
| **2C — edits on the deal page** | Inline edits route to the right table (identity/commission → clients; lead → leads; program → programs). `lead.status` authoritative; `program.status` derived. | Edit each class → correct table updates; status propagates; no regression in list tabs / brief gate. |
| **2D — navigation round-trips** | `returnTo` for estimate↔venue + budget builder; builders link back to the deal; scroll restoration for jumps. | Open estimate from deal → edit venue → land back on estimate; back → land at Events. |
| **2E — redirects** | `/leads/[id]` and `/programs/[id]` → `/deals/[clientId]`; repoint board/list cards. | Old URLs redirect with anchor; cards land on deal page. |
| **2F — board unification (optional)** | Merge to one Pipeline board; Programs list → Financials lens. | Deferred pending §boards + status decision. |

## Risks
- `client_id ≈ deal` (1:1) today. If a company ever needs *multiple* deals, grouping by
  `client_id` collapses them — would then need a separate `deal_id`. Note, don't build for it now.
- 2C is the real engineering (status authority + write routing). 2A/2B are low-risk composition.

## Phase 2A implementation (shipped on `feat/clients-normalize-phase2a`)
- `src/lib/clients/clientFields.ts` — pure, server-free field-mapping (`clientRowFromLead`,
  `clientRowFromProgram`, `ClientInsert`). Mirrors `scripts/migrateClients.ts`. Unit-tested.
- `src/lib/clients/sync.ts` — async helpers taking a supabase client (works for session +
  service-role): `createClientFromLead`, `createClientFromProgram`, `ensureLeadClientId`,
  `deleteClientIfOrphaned`. Best-effort: a clients-table error returns null / is swallowed and
  never blocks lead/program creation or deletion.
- Wired into all 4 write paths: `createLead` + `createProgramFromLead` (leads/actions.ts),
  `createProgram` (programs/actions.ts), `writeLead` (scanner/writer.ts).
- Orphan GC: `deleteLead` + `deleteProgram` capture the deleted record's `client_id` and call
  `deleteClientIfOrphaned`, which removes the client ONLY when zero leads AND zero programs
  still reference it (a shared lead+program deal keeps its client when one half is deleted;
  fail-safe — an unconfirmable count keeps the client).
- `getDealByClientId` + `DbClient`/`Deal` types in `queries.ts`.
- Tests: `tests/unit/clientFields.test.ts`.
- **No migration** — Phase 1 already added the columns. Purely a write-path activation.

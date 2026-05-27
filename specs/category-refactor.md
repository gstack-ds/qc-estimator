# Category Refactor — Dynamic Sections

## Goal
Replace hard-coded section string matching in the pricing engine with a stable `taxBucket` enum.
Allow users to rename sections, add new sections, and delete empty sections — without touching the pricing engine.

## Done criteria
- All 189+ existing tests still pass (no regressions)
- Engine groups line items by `taxBucket` field, not section string
- Section names are editable in each builder via inline rename
- New sections can be added (user picks name + markup template)
- Empty sections can be deleted
- DB persists section definitions per estimate; existing data is backfilled

---

## Architecture

### New type: `TaxBucket`
```typescript
export type TaxBucket = 'fb' | 'equipment' | 'venue' | 'staffing';
```
Added to `src/types/index.ts`. Added as required field on `LineItem`.

### Engine change (pricing.ts)
Before: `calculated.filter(li => li.section === 'F&B')`
After:  `calculated.filter(li => li.taxBucket === 'fb')`
Remove `DECOR_TAXABLE` and `DECOR_NONTAXABLE` sets — no longer needed.
Section-string matching is completely eliminated.

### New DB table: `estimate_sections`
```sql
id UUID PRIMARY KEY
estimate_id UUID REFERENCES estimates(id)
name TEXT                    -- display name, user can edit
tax_bucket TEXT              -- 'fb' | 'equipment' | 'venue' | 'staffing'
markup_pct NUMERIC           -- default markup for new items in this section
sort_order INTEGER
is_built_in BOOLEAN          -- built-ins can be renamed but not structurally changed
```
Each estimate row has its own section rows — no cross-estimate sharing.

### FK on `estimate_line_items`
```sql
section_id UUID REFERENCES estimate_sections(id)
```
Engine reads `taxBucket` from the section when building `LineItem` objects.

### New TypeScript interface: `LocalSectionDef`
```typescript
interface LocalSectionDef {
  id: string;        // DB UUID
  name: string;      // display name (editable)
  taxBucket: TaxBucket;
  markupPct: number; // default for new items
}
```
Replaces the `LocalSection` union type string in builders. Section becomes `string` (the UUID) on `LocalLineItem`.

### `LineItem` interface update
```typescript
export interface LineItem {
  id: string;
  section: string;    // keep for backwards compat / display
  taxBucket: TaxBucket;  // NEW — used by engine
  name: string;
  // ... rest unchanged
}
```

---

## Implementation Order

1. **Types** — add `TaxBucket` to `src/types/index.ts`, add `taxBucket` to `LineItem`
2. **Test fixtures** — add `taxBucket` to every `LineItem` fixture in all test files (pricing.test.ts, proposal-validation.test.ts, export.test.ts) — tests still pass because engine hasn't changed yet
3. **New engine tests** — write tests that verify `taxBucket` routing directly (before changing engine)
4. **Engine refactor** — switch `calculateVenueEstimate` to use `taxBucket` filters; remove DECOR_* sets
5. **DB migration** — `025_estimate_sections.sql`: create table, add FK, seed defaults from existing section text, backfill `section_id`
6. **Queries** — add `DbEstimateSection`, `getEstimateSections`, update `DbLineItem`/`LINE_ITEM_FIELDS`, add `upsertEstimateSection`, `deleteEstimateSection`
7. **Actions** — section CRUD server actions; add `section_id` to `upsertLineItem`
8. **page.tsx** — fetch sections, call `ensureDefaultSections` if empty, pass `dbSections` to builders
9. **EstimateBuilder** — `LocalSection` union → `LocalSectionDef`, inline rename, add/delete section UI
10. **AvEstimateBuilder** — same
11. **DecorEstimateBuilder** — drop Florals/Rentals parent card grouping; flat dynamic sections
12. **LineItemSection** — accept `onRename`/`onDelete` props, render inline edit UI

---

## Key files
- `src/types/index.ts`
- `src/lib/engine/pricing.ts`
- `tests/unit/pricing.test.ts`
- `tests/unit/proposal-validation.test.ts`
- `tests/unit/export.test.ts`
- `supabase/migrations/025_estimate_sections.sql`
- `src/lib/supabase/queries.ts`
- `src/app/(programs)/programs/[id]/estimates/actions.ts`
- `src/app/(programs)/programs/[id]/estimates/[estimateId]/page.tsx`
- `src/components/estimates/EstimateBuilder.tsx`
- `src/components/estimates/AvEstimateBuilder.tsx`
- `src/components/estimates/DecorEstimateBuilder.tsx`
- `src/components/estimates/LineItemSection.tsx`

---

## Default sections per estimate type

### Venue
| name | taxBucket | markupPct |
|------|-----------|-----------|
| F&B | fb | 0.55 |
| Equipment & Staffing | equipment | 0.65 |
| Venue Fees | venue | 0.60 |
| Non-Taxable Staffing | staffing | 0.90 |

### AV
| name | taxBucket | markupPct |
|------|-----------|-----------|
| AV & Production | equipment | 0.65 |
| Non-Taxable Staffing | staffing | 0.90 |

### Decor
| name | taxBucket | markupPct |
|------|-----------|-----------|
| Florals - Taxable | equipment | 0.85 |
| Florals - Non-Taxable | staffing | 0.85 |
| Rentals - Seating | equipment | 0.85 |
| Rentals - Lounge | equipment | 0.85 |
| Rentals - Tables | equipment | 0.85 |
| Rentals - Rugs & Accessories | equipment | 0.85 |
| Rentals - Non-Taxable | staffing | 0.85 |
| Non-Taxable Staffing | staffing | 0.90 |

---

## Constraints
- Engine must produce IDENTICAL results after refactor
- `taxBucket` drives all tax/bucket grouping; section name is display-only
- Built-in sections: rename allowed, delete blocked if items exist
- User-added sections: rename + delete (block if items exist)
- All three builders get Add/Delete/Rename — same pattern

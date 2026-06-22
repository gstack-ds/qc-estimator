// Client-capture validation + server-side total computation. Server-free + pure → fully testable,
// and shared by the Route Handler. This is the security boundary for the IN direction:
//
//   The client may ONLY submit references to options that already exist in the locked snapshot —
//   a tier from the line's own tiers, a bounded guest count, a target keyed to a real event, and
//   free-text notes. Everything else is dropped. The total is ALWAYS recomputed here from the
//   snapshot's locked prices × the validated selections; any client-sent total/price is ignored
//   because we never read such a field.

import { z } from 'zod';
import {
  type BudgetShareContract,
} from './budgetShareContract';
import {
  type BudgetLine,
  type BudgetTier,
  lineMode,
  computeBudgetTotals,
  selectedMember,
} from './budgetDocument';

// ── Bounds ────────────────────────────────────────────────────────────────────
export const GUEST_MIN = 1;
export const GUEST_MAX = 100_000;
export const NOTES_MAX = 4_000;
export const TARGET_MAX = 1_000_000_000;
const MAX_LINE_SELECTIONS = 1_000;
const MAX_CATEGORY_TARGETS = 200;

// ── Raw payload shape (Zod) ─────────────────────────────────────────────────────
// .strip() (Zod default) drops unknown keys, so a client-sent `price`/`total`/etc. never survives
// parsing. Bounds are enforced here; snapshot-membership is enforced in validateResponse().
export const RespondPayloadSchema = z.object({
  lineSelections: z.array(z.object({
    lineId: z.string().min(1).max(100),
    tier: z.enum(['low', 'mid', 'high']).optional(),
    guestCount: z.number().int().min(GUEST_MIN).max(GUEST_MAX).optional(),
  })).max(MAX_LINE_SELECTIONS).optional().default([]),
  categoryTargets: z.array(z.object({
    eventId: z.string().min(1).max(100),
    amount: z.number().min(0).max(TARGET_MAX),
  })).max(MAX_CATEGORY_TARGETS).optional().default([]),
  notes: z.string().max(NOTES_MAX).optional().default(''),
});

export type RespondPayload = z.infer<typeof RespondPayloadSchema>;

// ── Validated, snapshot-checked result ──────────────────────────────────────────
export interface ValidatedLineSelection {
  lineId: string;
  tier?: BudgetTier;
  guestCount?: number;
}
export interface ValidatedCategoryTarget {
  eventId: string;
  amount: number;
}
export interface ValidatedResponse {
  lineSelections: ValidatedLineSelection[];
  categoryTargets: ValidatedCategoryTarget[];
  notes: string;
  computedTotal: number;
  computedByEvent: Record<string, number>;
}

/** The tiers actually available on a line (only meaningful for a tiered line). */
function availableTiers(line: BudgetLine): Set<BudgetTier> {
  if (lineMode(line) !== 'tiers') return new Set();
  return new Set(line.members.map((m) => m.tier).filter((t): t is BudgetTier => t != null));
}

/**
 * Validate a (Zod-parsed) payload against the locked snapshot and compute the authoritative total.
 * Drops any selection that doesn't reference something real in the snapshot. Never trusts a
 * client-supplied amount for anything except a category TARGET (which is the client's own goal and
 * never touches pricing).
 */
export function validateResponse(contract: BudgetShareContract, payload: RespondPayload): ValidatedResponse {
  const lineById = new Map(contract.lines.map((l) => [l.id, l]));
  const eventIds = new Set(contract.events.map((e) => e.id));

  // 1. Sanitize line selections against the snapshot.
  const lineSelections: ValidatedLineSelection[] = [];
  for (const sel of payload.lineSelections) {
    const line = lineById.get(sel.lineId);
    if (!line) continue; // non-existent line → drop entirely

    const out: ValidatedLineSelection = { lineId: sel.lineId };
    if (sel.tier !== undefined && availableTiers(line).has(sel.tier)) {
      out.tier = sel.tier; // tier kept only if this line actually offers it
    }
    if (sel.guestCount !== undefined && line.isPerPerson) {
      out.guestCount = sel.guestCount; // guest count only meaningful on a per-person line
    }
    // Keep the row only if it carries a usable adjustment.
    if (out.tier !== undefined || out.guestCount !== undefined) lineSelections.push(out);
  }

  // 2. Sanitize category targets — keyed to real events only. The amount is the client's own
  //    number (a goal), so it's bounded but never validated against our prices.
  const seenEvents = new Set<string>();
  const categoryTargets: ValidatedCategoryTarget[] = [];
  for (const t of payload.categoryTargets) {
    if (!eventIds.has(t.eventId) || seenEvents.has(t.eventId)) continue;
    seenEvents.add(t.eventId);
    categoryTargets.push({ eventId: t.eventId, amount: t.amount });
  }

  // 3. Apply the validated selections to a CLONE of the locked snapshot and recompute server-side.
  const selByLine = new Map(lineSelections.map((s) => [s.lineId, s]));
  const appliedLines: BudgetLine[] = contract.lines.map((line) => {
    const sel = selByLine.get(line.id);
    if (!sel) return line;
    let selectedMemberId = line.selectedMemberId;
    if (sel.tier !== undefined && lineMode(line) === 'tiers') {
      const m = line.members.find((mm) => mm.tier === sel.tier);
      if (m) selectedMemberId = m.id;
    }
    return {
      ...line,
      selectedMemberId,
      guestCount: sel.guestCount !== undefined ? sel.guestCount : line.guestCount,
    };
  });

  const totals = computeBudgetTotals(
    { id: '', programId: '', title: null, status: '', disclaimers: null, lines: appliedLines },
    contract.guestCount,
    contract.guestCount,
  );
  const computedByEvent: Record<string, number> = {};
  for (const [key, v] of Object.entries(totals.byEvent)) computedByEvent[key] = v.selected;

  return {
    lineSelections,
    categoryTargets,
    notes: payload.notes.slice(0, NOTES_MAX),
    computedTotal: totals.selected,
    computedByEvent,
  };
}

// Re-export for the form's optional client-side preview (same engine the server uses).
export { selectedMember };

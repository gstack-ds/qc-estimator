// Server-free constants + pure helpers for callouts. No React, no Supabase, no next/headers —
// safe to import from client components AND to unit-test in isolation.

export type CalloutStatus = 'open' | 'resolved';

// Lightweight single-select categories (seed set). Stored as free TEXT in the DB so new
// categories can be added later without a migration; the UI offers these five.
export const CALLOUT_CATEGORIES = [
  'Venue/Capacity',
  'AV/Permitting',
  'Vendor/Timing',
  'Budget',
  'Other',
] as const;

export type CalloutCategory = (typeof CALLOUT_CATEGORIES)[number];

// Badge classes per category (client-facing? no — internal only). Falls back to neutral.
export const CATEGORY_CLASSES: Record<string, string> = {
  'Venue/Capacity': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'AV/Permitting': 'bg-amber-50 text-amber-700 border-amber-100',
  'Vendor/Timing': 'bg-teal-50 text-teal-700 border-teal-100',
  Budget: 'bg-rose-50 text-rose-700 border-rose-100',
  Other: 'bg-stone-100 text-stone-600 border-stone-200',
};

export function categoryClasses(category: string | null | undefined): string {
  if (!category) return CATEGORY_CLASSES.Other;
  return CATEGORY_CLASSES[category] ?? CATEGORY_CLASSES.Other;
}

// Normalize an arbitrary string to a known category, or null. Used when filtering/validating.
export function normalizeCategory(raw: unknown): CalloutCategory | null {
  if (typeof raw !== 'string') return null;
  const match = CALLOUT_CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
  return match ?? null;
}

export function isOpen(status: string): boolean {
  return status === 'open';
}

// Minimal shape the count helpers need — keeps them decoupled from DB row types.
export interface CalloutLike {
  estimate_id: string;
  event_id: string | null;
  status: string;
}

// Total open callouts in a list (nav badge / team-wide count).
export function countOpen(callouts: CalloutLike[]): number {
  return callouts.reduce((n, c) => (isOpen(c.status) ? n + 1 : n), 0);
}

// Map of estimate_id -> open callout count (per-estimate-card badge).
export function openCountByEstimate(callouts: CalloutLike[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of callouts) {
    if (!isOpen(c.status)) continue;
    out[c.estimate_id] = (out[c.estimate_id] ?? 0) + 1;
  }
  return out;
}

// Map of event_id -> open callout count (event-header aggregate). Null event_id is ignored.
export function openCountByEvent(callouts: CalloutLike[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of callouts) {
    if (!isOpen(c.status) || !c.event_id) continue;
    out[c.event_id] = (out[c.event_id] ?? 0) + 1;
  }
  return out;
}

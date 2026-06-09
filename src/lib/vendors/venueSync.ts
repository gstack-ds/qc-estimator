// Pure functions for two-way venue ↔ estimate sync.
// No React / Next.js / Supabase dependencies.

export type SpaceSyncClass = 'in_sync' | 'blank_vendor' | 'differing' | 'no_value';

/**
 * Classifies the relationship between an estimate's fbMinimum and a vendor
 * space's stored fb_minimum, determining whether a write-back is needed.
 *
 * - no_value:    estimate has no meaningful value (0 or less) — nothing to write
 * - blank_vendor: vendor has no value (null/0) — auto-save silently
 * - in_sync:     values match — no write needed
 * - differing:   values differ — ask user before overwriting
 */
export function classifySpaceSync(
  estimateValue: number,
  spaceValue: number | null | undefined,
): SpaceSyncClass {
  if (estimateValue <= 0) return 'no_value';
  if (spaceValue == null || spaceValue <= 0) return 'blank_vendor';
  if (spaceValue === estimateValue) return 'in_sync';
  return 'differing';
}

/** Strip non-alphanumeric chars and lowercase for fuzzy name matching. */
export function normalizeSpaceName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Find a space in the list whose normalized name matches roomSpaceName.
 * Returns null when no match or when the input name is empty.
 */
export function findMatchingSpace<T extends { id: string; name: string }>(
  roomSpaceName: string,
  spaces: T[],
): T | null {
  const normalized = normalizeSpaceName(roomSpaceName);
  if (!normalized) return null;
  return spaces.find((s) => normalizeSpaceName(s.name) === normalized) ?? null;
}

/**
 * Returns true when the current value equals the value that was last
 * auto-filled from the vendor space (i.e. the user has not changed it).
 * Used as the loop guard: if true, skip write-back so Part 1 and Part 2
 * don't trigger each other.
 */
export function isAutoFilled(
  currentValue: number,
  autoFilledValue: number | undefined,
): boolean {
  if (autoFilledValue === undefined) return false;
  return currentValue === autoFilledValue;
}

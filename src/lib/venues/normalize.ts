/** Normalize an address for duplicate detection: lowercase, collapse whitespace, strip punctuation. */
export function normalizeAddress(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Normalize a venue name for fuzzy-match detection: lowercase, strip all non-alphanumeric. */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Normalize an address for duplicate detection: lowercase, collapse whitespace, strip punctuation. */
export function normalizeAddress(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Normalize a venue name for fuzzy-match detection: lowercase, strip all non-alphanumeric. */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Map from lowercase-collapsed city input → canonical storage value.
// Add new entries here when other cities need variant consolidation.
const CANONICAL_CITY_MAP: Record<string, string> = {
  'washington':        'Washington, DC',
  'washington dc':     'Washington, DC',
  'washington, dc':    'Washington, DC',
  'washington d.c.':   'Washington, DC',
  'washington, d.c.':  'Washington, DC',
};

/**
 * Normalize a city name for consistent storage:
 *  1. Trim and collapse internal whitespace.
 *  2. Apply canonical map for known special cases (e.g. DC variants → "Washington, DC").
 *  3. Default: title-case the result.
 */
export function normalizeCity(city: string): string {
  if (!city) return city;
  const collapsed = city.trim().replace(/\s+/g, ' ');
  const key = collapsed.toLowerCase();
  if (key in CANONICAL_CITY_MAP) return CANONICAL_CITY_MAP[key];
  return collapsed.replace(/\b\w/g, (c) => c.toUpperCase());
}

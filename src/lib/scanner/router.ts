// Region → suggested owner routing.
// Config is data-driven so it can be updated without touching logic.

export interface RegionRule {
  keywords: string[];   // lowercase substrings to match against region/city/state
  owner: string;
}

// Routing map: add or edit rules here, or load from DB in Phase 2.
export const REGION_RULES: RegionRule[] = [
  {
    keywords: ['charlotte', 'north carolina', 'nc', 'raleigh', 'durham', 'asheville'],
    owner: 'Alex',
  },
  {
    keywords: ['dc', 'washington', 'd.c.', 'maryland', 'md', 'virginia', 'va', 'nova', 'northern virginia', 'new york', 'ny', 'nyc', 'philadelphia', 'philly', 'pa'],
    owner: 'Lindsey',
  },
  {
    keywords: ['georgia', 'ga', 'atlanta'],
    owner: 'Lydia',
  },
];

/**
 * Returns the suggested owner for a given region string, or null if no match.
 * Checks region first, then falls back to city + state combined.
 */
export function suggestOwner(
  region: string | null | undefined,
  city?: string | null,
  state?: string | null,
): string | null {
  const haystack = [region, city, state]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack) return null;

  for (const rule of REGION_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.owner;
    }
  }
  return null;
}

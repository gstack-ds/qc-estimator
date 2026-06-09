// Pure functions for vendor merge logic — no React/Next/Supabase deps.

/**
 * JSONB fields (menus, bar_options, inclusions) default to [].
 * Survivor wins unless its value is null or an empty array; then use loser's.
 */
export function mergeJsonb(survivor: unknown, loser: unknown): unknown {
  if (survivor === null || (Array.isArray(survivor) && survivor.length === 0)) {
    return loser;
  }
  return survivor;
}

/**
 * Nullable text fields: survivor wins unless null or empty string.
 */
export function mergeText(survivor: string | null | undefined, loser: string | null | undefined): string | null {
  if (survivor === null || survivor === undefined || survivor === '') {
    return loser ?? null;
  }
  return survivor;
}

export interface SpaceRef {
  id: string;
  name: string;
}

export interface DuplicateSpace {
  survivorSpaceId: string;
  loserSpaceId: string;
  name: string;
}

/**
 * Find spaces in loserSpaces whose name (case-insensitive, trimmed)
 * matches a space already on the survivor.
 */
export function detectDuplicateSpaces(survivorSpaces: SpaceRef[], loserSpaces: SpaceRef[]): DuplicateSpace[] {
  const survivorMap = new Map(survivorSpaces.map((s) => [s.name.toLowerCase().trim(), s.id]));
  return loserSpaces
    .filter((ls) => survivorMap.has(ls.name.toLowerCase().trim()))
    .map((ls) => ({
      survivorSpaceId: survivorMap.get(ls.name.toLowerCase().trim())!,
      loserSpaceId: ls.id,
      name: ls.name,
    }));
}

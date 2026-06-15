export function mergeJsonb(survivor: unknown, loser: unknown): unknown {
  if (survivor === null || (Array.isArray(survivor) && survivor.length === 0)) {
    return loser;
  }
  return survivor;
}

export function mergeText(
  survivor: string | null | undefined,
  loser: string | null | undefined
): string | null {
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

export function detectDuplicateSpaces(
  survivorSpaces: SpaceRef[],
  loserSpaces: SpaceRef[]
): DuplicateSpace[] {
  const survivorMap = new Map(survivorSpaces.map((s) => [s.name.toLowerCase().trim(), s.id]));
  return loserSpaces
    .filter((ls) => survivorMap.has(ls.name.toLowerCase().trim()))
    .map((ls) => ({
      survivorSpaceId: survivorMap.get(ls.name.toLowerCase().trim())!,
      loserSpaceId: ls.id,
      name: ls.name,
    }));
}

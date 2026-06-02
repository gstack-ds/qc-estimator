import { normalizeAddress, normalizeName } from './normalize';

export type VenueValidationResult =
  | { ok: true }
  | { ok: false; reason: 'missing_address' }
  | { ok: false; reason: 'duplicate_address'; existingId: string; existingName: string }
  | { ok: false; reason: 'similar_name'; existingId: string; existingName: string };

/**
 * Pure function — validates venue name + address against existing venues.
 * Called by createVenue (server action) and unit-tested independently.
 */
export function validateVenueInput(
  data: { name: string; address?: string | null },
  existingVenues: { id: string; name: string; address: string | null }[],
  skipNameCheck = false,
): VenueValidationResult {
  if (!data.address?.trim()) {
    return { ok: false, reason: 'missing_address' };
  }

  const normAddr = normalizeAddress(data.address.trim());
  const normName = normalizeName(data.name.trim());

  const addrMatch = existingVenues.find(
    (v) => v.address && normalizeAddress(v.address) === normAddr,
  );
  if (addrMatch) {
    return { ok: false, reason: 'duplicate_address', existingId: addrMatch.id, existingName: addrMatch.name };
  }

  if (!skipNameCheck) {
    const nameMatch = existingVenues.find((v) => normalizeName(v.name) === normName);
    if (nameMatch) {
      return { ok: false, reason: 'similar_name', existingId: nameMatch.id, existingName: nameMatch.name };
    }
  }

  return { ok: true };
}

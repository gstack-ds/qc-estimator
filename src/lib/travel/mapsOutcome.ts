// Pure classification + messaging for Google Distance Matrix results. Server-free + testable:
// the fetch lives in the server action; the decision logic + user-facing copy live here.
// origin = the hotel (program.client_hotel); destination = the venue.

export type TravelEndpoint = 'origin' | 'destination';

export type MapsOutcome =
  | { kind: 'ok'; distanceMeters: number; durationSeconds: number }
  // Real API/config/billing problem — HTTP error, or a top-level status like REQUEST_DENIED /
  // OVER_QUERY_LIMIT. The "enable the API / check billing" message is correct ONLY here.
  | { kind: 'api' }
  // A geocode failure — Distance Matrix could not resolve one endpoint's string to a place
  // (element NOT_FOUND / ZERO_RESULTS). `which` names the offending side so the message can too.
  | { kind: 'unresolved'; which: TravelEndpoint };

export interface MapsDistanceResponse {
  status?: string;
  // Distance Matrix echoes the geocoded address for each input; the entry is an EMPTY STRING
  // for an input it couldn't geocode — that's how we tell which side failed.
  origin_addresses?: string[];
  destination_addresses?: string[];
  rows?: { elements: { status: string; distance?: { value: number }; duration?: { value: number } }[] }[];
}

// Classify a Distance Matrix HTTP response. `httpOk` = res.ok; `data` is the parsed JSON (or null).
export function classifyMapsResponse(httpOk: boolean, data: MapsDistanceResponse | null): MapsOutcome {
  // HTTP failure or unparseable body → API/config problem.
  if (!httpOk || !data) return { kind: 'api' };
  // Top-level non-OK (REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST, UNKNOWN_ERROR, …) → API.
  if (data.status && data.status !== 'OK') return { kind: 'api' };

  const el = data.rows?.[0]?.elements?.[0];
  if (!el) return { kind: 'api' };

  if (el.status === 'OK' && el.distance && el.duration) {
    return { kind: 'ok', distanceMeters: el.distance.value, durationSeconds: el.duration.value };
  }

  if (el.status === 'NOT_FOUND' || el.status === 'ZERO_RESULTS') {
    const originResolved = !!data.origin_addresses?.[0];
    const destResolved = !!data.destination_addresses?.[0];
    // Name the side whose geocoded address came back empty. If both (or neither) are empty,
    // blame the destination — the venue is the far more common culprit (53% lack an address).
    if (!originResolved && destResolved) return { kind: 'unresolved', which: 'origin' };
    return { kind: 'unresolved', which: 'destination' };
  }

  // Any other element status (e.g. MAX_ROUTE_LENGTH_EXCEEDED) → treat as an API/unknown problem.
  return { kind: 'api' };
}

const API_MESSAGE =
  'Travel time calculation failed. Verify that the Distance Matrix API is enabled in Google Cloud Console and billing is active on the project.';

// Map a non-ok outcome to user-facing copy. Names the specific field for geocode failures;
// keeps the billing/enabled message ONLY for genuine API problems.
export function travelErrorMessage(
  outcome: { kind: 'api' } | { kind: 'unresolved'; which: TravelEndpoint },
): string {
  if (outcome.kind === 'api') return API_MESSAGE;
  return outcome.which === 'origin'
    ? "Couldn't locate the hotel address — check the program's hotel."
    : "Couldn't locate the venue address — check the venue's address.";
}

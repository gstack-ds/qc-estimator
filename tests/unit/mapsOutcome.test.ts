import { describe, it, expect } from 'vitest';
import {
  classifyMapsResponse,
  travelErrorMessage,
  type MapsDistanceResponse,
} from '../../src/lib/travel/mapsOutcome';

const okEl = { status: 'OK', distance: { value: 8047 }, duration: { value: 600 } };

describe('classifyMapsResponse', () => {
  it('ok: top-level OK + element OK → distance/duration', () => {
    const data: MapsDistanceResponse = {
      status: 'OK',
      origin_addresses: ['Hotel, Atlanta, GA'],
      destination_addresses: ['Venue, Atlanta, GA'],
      rows: [{ elements: [okEl] }],
    };
    const o = classifyMapsResponse(true, data);
    expect(o).toEqual({ kind: 'ok', distanceMeters: 8047, durationSeconds: 600 });
  });

  it('api: HTTP not ok → api', () => {
    expect(classifyMapsResponse(false, null)).toEqual({ kind: 'api' });
  });

  it('api: top-level REQUEST_DENIED → api (real config/billing problem)', () => {
    expect(classifyMapsResponse(true, { status: 'REQUEST_DENIED' })).toEqual({ kind: 'api' });
  });

  it('api: top-level OVER_QUERY_LIMIT → api', () => {
    expect(classifyMapsResponse(true, { status: 'OVER_QUERY_LIMIT' })).toEqual({ kind: 'api' });
  });

  it('unresolved destination: element NOT_FOUND with empty destination_addresses → which=destination', () => {
    const data: MapsDistanceResponse = {
      status: 'OK',
      origin_addresses: ['Loews Atlanta, GA'],
      destination_addresses: [''], // venue could not be geocoded
      rows: [{ elements: [{ status: 'NOT_FOUND' }] }],
    };
    expect(classifyMapsResponse(true, data)).toEqual({ kind: 'unresolved', which: 'destination' });
  });

  it('unresolved origin: element NOT_FOUND with empty origin_addresses → which=origin', () => {
    const data: MapsDistanceResponse = {
      status: 'OK',
      origin_addresses: [''], // hotel could not be geocoded
      destination_addresses: ['Venue, Atlanta, GA'],
      rows: [{ elements: [{ status: 'NOT_FOUND' }] }],
    };
    expect(classifyMapsResponse(true, data)).toEqual({ kind: 'unresolved', which: 'origin' });
  });

  it('both endpoints unresolvable → blames the destination (venue is the common culprit)', () => {
    const data: MapsDistanceResponse = {
      status: 'OK',
      origin_addresses: [''],
      destination_addresses: [''],
      rows: [{ elements: [{ status: 'NOT_FOUND' }] }],
    };
    expect(classifyMapsResponse(true, data)).toEqual({ kind: 'unresolved', which: 'destination' });
  });

  it('ZERO_RESULTS with both resolved → unresolved/destination (route issue, not API)', () => {
    const data: MapsDistanceResponse = {
      status: 'OK',
      origin_addresses: ['A'],
      destination_addresses: ['B'],
      rows: [{ elements: [{ status: 'ZERO_RESULTS' }] }],
    };
    expect(classifyMapsResponse(true, data)).toEqual({ kind: 'unresolved', which: 'destination' });
  });

  it('api: an unexpected element status (e.g. MAX_ROUTE_LENGTH_EXCEEDED) → api', () => {
    const data: MapsDistanceResponse = {
      status: 'OK',
      rows: [{ elements: [{ status: 'MAX_ROUTE_LENGTH_EXCEEDED' }] }],
    };
    expect(classifyMapsResponse(true, data)).toEqual({ kind: 'api' });
  });
});

describe('travelErrorMessage (api vs origin-unresolved vs destination-unresolved)', () => {
  it('api → keeps the Distance-Matrix-enabled / billing message', () => {
    const msg = travelErrorMessage({ kind: 'api' });
    expect(msg).toMatch(/Distance Matrix API is enabled/);
    expect(msg).toMatch(/billing is active/);
  });

  it('unresolved destination → names the VENUE, not the API', () => {
    const msg = travelErrorMessage({ kind: 'unresolved', which: 'destination' });
    expect(msg).toMatch(/venue/i);
    expect(msg).not.toMatch(/billing|Distance Matrix API/);
  });

  it('unresolved origin → names the HOTEL, not the API', () => {
    const msg = travelErrorMessage({ kind: 'unresolved', which: 'origin' });
    expect(msg).toMatch(/hotel/i);
    expect(msg).not.toMatch(/billing|Distance Matrix API/);
  });
});

import { describe, it, expect } from 'vitest';
import { normalizeExtractedProfile } from '../../src/lib/vendors/extractedVendorTypes';

// Fixture: a PDF line like "Up-Stairs Dining Room Full Rental — Dinner $3,500"
// followed by a SEPARATE "Food and Beverage Minimum: $2,000" line.
// Bug: without room_fee in the schema, Claude has nowhere to put the rental price
// so it lands in fb_minimum and the actual F&B minimum is lost or swapped.

describe('normalizeExtractedProfile — space room_fee vs fb_minimum', () => {
  it('preserves both room_fee and fb_minimum when both are present in raw data', () => {
    const raw = {
      spaces: [
        {
          name: 'Up-Stairs Dining Room',
          capacity_seated: 80,
          room_fee: 3500,
          fb_minimum: 2000,
        },
      ],
    };
    const profile = normalizeExtractedProfile(raw);
    expect(profile.spaces).toHaveLength(1);
    expect(profile.spaces[0].room_fee).toBe(3500);
    expect(profile.spaces[0].fb_minimum).toBe(2000);
  });

  it('does not place room_fee value into fb_minimum', () => {
    const raw = {
      spaces: [{ name: 'Main Hall', room_fee: 5000, fb_minimum: 15000 }],
    };
    const profile = normalizeExtractedProfile(raw);
    // If room_fee were ignored and its value bled into fb_minimum, fb_minimum would be 5000.
    expect(profile.spaces[0].fb_minimum).toBe(15000);
    expect(profile.spaces[0].room_fee).toBe(5000);
  });

  it('returns null for room_fee when absent', () => {
    const raw = { spaces: [{ name: 'Ballroom', fb_minimum: 8000 }] };
    const profile = normalizeExtractedProfile(raw);
    expect(profile.spaces[0].room_fee).toBeNull();
    expect(profile.spaces[0].fb_minimum).toBe(8000);
  });

  it('coerces string room_fee to number', () => {
    const raw = { spaces: [{ name: 'Terrace', room_fee: '2500', fb_minimum: null }] };
    const profile = normalizeExtractedProfile(raw);
    expect(profile.spaces[0].room_fee).toBe(2500);
  });

  it('handles room_fee with no fb_minimum', () => {
    const raw = { spaces: [{ name: 'Loft', room_fee: 1200 }] };
    const profile = normalizeExtractedProfile(raw);
    expect(profile.spaces[0].room_fee).toBe(1200);
    expect(profile.spaces[0].fb_minimum).toBeNull();
  });
});

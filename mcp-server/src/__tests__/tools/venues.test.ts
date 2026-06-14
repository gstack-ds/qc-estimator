import { describe, it, expect, vi } from 'vitest';
import { handleSearchVenues, handleGetVenue } from '../../tools/venues';
import { createMockDb, ok, notFound } from '../helpers/mockDb';

const VENUE = {
  id: 'venue-1',
  name: '5Church Charlotte',
  city: 'Charlotte',
  state: 'NC',
  vendor_type: 'restaurant',
  market: 'Charlotte',
  contact_name: 'Jane Smith',
  contact_email: 'jane@5church.com',
  contact_phone: '704-555-0100',
  website: 'https://5church.com',
  service_styles: ['Plated', 'Family Style'],
  service_charge_default: 0.21,
  gratuity_default: null,
  admin_fee_default: 0.05,
  last_used_date: '2026-05-01',
  updated_at: '2026-05-01T00:00:00Z',
};

const FULL_VENUE = {
  ...VENUE,
  address: '127 N Tryon St',
  zip: '28202',
  contact_title: 'Events Manager',
  notes: 'Great private dining options',
  profile_notes: 'Preferred vendor',
  menus: { main: [] },
  bar_options: [{ name: 'Full Bar', price_per_person: 35 }],
  inclusions: null,
  created_at: '2025-01-01T00:00:00Z',
};

const SPACE = {
  id: 'space-1',
  name: 'Vault Room',
  capacity_seated: 60,
  capacity_standing: 100,
  fb_minimum: 3000,
  room_fee: 500,
  privacy_tag: 'private',
  notes: null,
};

describe('handleSearchVenues', () => {
  it('returns venues list with correct shape', async () => {
    const db = createMockDb({ venues: ok([VENUE]) });
    const result = await handleSearchVenues(db as never, {});

    expect(result.count).toBe(1);
    expect(result.venues[0].id).toBe('venue-1');
    expect(result.venues[0].name).toBe('5Church Charlotte');
    expect(result.venues[0].fee_defaults.service_charge).toBe(0.21);
  });

  it('passes vendor_type filter', async () => {
    const db = createMockDb({ venues: ok([]) });
    await handleSearchVenues(db as never, { vendor_type: 'restaurant' });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect((fromCall.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(
      ['vendor_type', 'restaurant']
    );
  });

  it('passes text query as or filter', async () => {
    const db = createMockDb({ venues: ok([]) });
    await handleSearchVenues(db as never, { query: 'Church' });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect((fromCall.or as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('Church');
  });

  it('passes market filter', async () => {
    const db = createMockDb({ venues: ok([]) });
    await handleSearchVenues(db as never, { market: 'Charlotte' });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect((fromCall.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(
      ['market', 'Charlotte']
    );
  });

  it('returns empty list when no venues match', async () => {
    const db = createMockDb({ venues: ok([]) });
    const result = await handleSearchVenues(db as never, { query: 'ZZZ' });
    expect(result.count).toBe(0);
  });
});

describe('handleGetVenue', () => {
  it('returns null for not-found venue', async () => {
    const db = createMockDb({
      venues: notFound(),
      venue_spaces: ok([]),
      estimates: ok([]),
    });
    const result = await handleGetVenue(db as never, { id: 'missing' });
    expect(result).toBeNull();
  });

  it('returns venue with spaces', async () => {
    const db = createMockDb({
      venues: ok(FULL_VENUE),
      venue_spaces: ok([SPACE]),
      estimates: ok([]),
    });
    const result = await handleGetVenue(db as never, { id: 'venue-1' });

    expect(result).not.toBeNull();
    expect(result!.name).toBe('5Church Charlotte');
    expect(result!.spaces).toHaveLength(1);
    expect(result!.spaces[0].name).toBe('Vault Room');
    expect(result!.spaces[0].capacity_seated).toBe(60);
    expect(result!.spaces[0].fb_minimum).toBe(3000);
    expect(result!.spaces[0].privacy_tag).toBe('private');
  });

  it('indicates has_menus when menus present', async () => {
    const db = createMockDb({
      venues: ok(FULL_VENUE),
      venue_spaces: ok([]),
      estimates: ok([]),
    });
    const result = await handleGetVenue(db as never, { id: 'venue-1' });
    expect(result!.has_menus).toBe(true);
    expect(result!.has_bar_options).toBe(true);
  });

  it('returns correct contact info', async () => {
    const db = createMockDb({
      venues: ok(FULL_VENUE),
      venue_spaces: ok([]),
      estimates: ok([]),
    });
    const result = await handleGetVenue(db as never, { id: 'venue-1' });
    expect(result!.contact.name).toBe('Jane Smith');
    expect(result!.contact.title).toBe('Events Manager');
    expect(result!.contact.email).toBe('jane@5church.com');
  });
});

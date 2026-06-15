import { describe, it, expect } from 'vitest';
import {
  normalizeDetectedEvent,
  normalizeEventType,
  hasExistingEvents,
  type DetectedEvent,
} from '../../src/lib/programs/eventDetection';

// ─── normalizeEventType ───────────────────────────────────────────────────────

describe('normalizeEventType', () => {
  it('maps valid enum values directly', () => {
    expect(normalizeEventType('formal_dinner')).toBe('formal_dinner');
    expect(normalizeEventType('cocktail_reception')).toBe('cocktail_reception');
    expect(normalizeEventType('breakfast')).toBe('breakfast');
    expect(normalizeEventType('lunch')).toBe('lunch');
    expect(normalizeEventType('excursion')).toBe('excursion');
    expect(normalizeEventType('dine_around')).toBe('dine_around');
    expect(normalizeEventType('general_session')).toBe('general_session');
    expect(normalizeEventType('logistics')).toBe('logistics');
    expect(normalizeEventType('experiential')).toBe('experiential');
    expect(normalizeEventType('custom')).toBe('custom');
  });

  it('maps natural-language aliases (case-insensitive)', () => {
    expect(normalizeEventType('dinner')).toBe('formal_dinner');
    expect(normalizeEventType('Gala')).toBe('formal_dinner');
    expect(normalizeEventType('Banquet')).toBe('formal_dinner');
    expect(normalizeEventType('Reception')).toBe('cocktail_reception');
    expect(normalizeEventType('Cocktail')).toBe('cocktail_reception');
    expect(normalizeEventType('Keynote')).toBe('general_session');
    expect(normalizeEventType('general session')).toBe('general_session');
    expect(normalizeEventType('Plenary')).toBe('general_session');
    expect(normalizeEventType('Tour')).toBe('excursion');
    expect(normalizeEventType('Luncheon')).toBe('lunch');
    expect(normalizeEventType('Brunch')).toBe('breakfast');
    expect(normalizeEventType('experience')).toBe('experiential');
    expect(normalizeEventType('restaurant dine around')).toBe('dine_around');
  });

  it('returns custom for unknown values', () => {
    expect(normalizeEventType('party')).toBe('custom');
    expect(normalizeEventType('wellness activity')).toBe('custom');
    expect(normalizeEventType('')).toBe('custom');
  });

  it('returns custom for null/non-string input', () => {
    expect(normalizeEventType(null)).toBe('custom');
    expect(normalizeEventType(undefined)).toBe('custom');
    expect(normalizeEventType(42)).toBe('custom');
    expect(normalizeEventType({})).toBe('custom');
    expect(normalizeEventType([])).toBe('custom');
  });
});

// ─── normalizeDetectedEvent ───────────────────────────────────────────────────

describe('normalizeDetectedEvent', () => {
  it('normalizes a well-formed event object', () => {
    const result = normalizeDetectedEvent({
      name: 'Gala Dinner',
      event_date: '2026-11-15',
      start_time: '18:30',
      end_time: '22:00',
      guest_count: 150,
      event_type: 'formal_dinner',
      description: 'Black tie dinner for 150 guests.',
    });
    expect(result).toEqual<DetectedEvent>({
      name: 'Gala Dinner',
      event_date: '2026-11-15',
      start_time: '18:30',
      end_time: '22:00',
      guest_count: 150,
      event_type: 'formal_dinner',
      description: 'Black tie dinner for 150 guests.',
    });
  });

  it('defaults name to "Event" when missing or blank', () => {
    expect(normalizeDetectedEvent({ name: '' }).name).toBe('Event');
    expect(normalizeDetectedEvent({ name: '   ' }).name).toBe('Event');
    expect(normalizeDetectedEvent({}).name).toBe('Event');
    expect(normalizeDetectedEvent({ name: null }).name).toBe('Event');
  });

  it('defaults guest_count to 0 for missing or non-numeric value', () => {
    expect(normalizeDetectedEvent({ guest_count: null }).guest_count).toBe(0);
    expect(normalizeDetectedEvent({ guest_count: 'many' }).guest_count).toBe(0);
    expect(normalizeDetectedEvent({ guest_count: -1 }).guest_count).toBe(0);
    expect(normalizeDetectedEvent({}).guest_count).toBe(0);
  });

  it('floors decimal guest_count', () => {
    expect(normalizeDetectedEvent({ guest_count: 99.9 }).guest_count).toBe(99);
  });

  it('rejects Infinity and NaN for guest_count', () => {
    expect(normalizeDetectedEvent({ guest_count: Infinity }).guest_count).toBe(0);
    expect(normalizeDetectedEvent({ guest_count: NaN }).guest_count).toBe(0);
  });

  it('defaults event_type to custom for bad/missing type', () => {
    expect(normalizeDetectedEvent({ event_type: 'party' }).event_type).toBe('custom');
    expect(normalizeDetectedEvent({ event_type: null }).event_type).toBe('custom');
    expect(normalizeDetectedEvent({}).event_type).toBe('custom');
    expect(normalizeDetectedEvent({ event_type: 42 }).event_type).toBe('custom');
  });

  it('coerces natural-language event_type', () => {
    expect(normalizeDetectedEvent({ event_type: 'gala' }).event_type).toBe('formal_dinner');
    expect(normalizeDetectedEvent({ event_type: 'Tour' }).event_type).toBe('excursion');
  });

  it('rejects malformed event_date', () => {
    expect(normalizeDetectedEvent({ event_date: 'November 15, 2026' }).event_date).toBeNull();
    expect(normalizeDetectedEvent({ event_date: 'TBD' }).event_date).toBeNull();
    expect(normalizeDetectedEvent({ event_date: '' }).event_date).toBeNull();
    expect(normalizeDetectedEvent({ event_date: '11/15/2026' }).event_date).toBeNull();
    expect(normalizeDetectedEvent({ event_date: null }).event_date).toBeNull();
  });

  it('accepts valid YYYY-MM-DD event_date', () => {
    expect(normalizeDetectedEvent({ event_date: '2026-11-15' }).event_date).toBe('2026-11-15');
  });

  it('returns safe defaults for null/non-object input', () => {
    const result = normalizeDetectedEvent(null);
    expect(result.name).toBe('Event');
    expect(result.event_type).toBe('custom');
    expect(result.guest_count).toBe(0);
    expect(result.event_date).toBeNull();
    expect(result.description).toBeNull();

    const result2 = normalizeDetectedEvent('bad string');
    expect(result2.name).toBe('Event');
  });

  it('sets description to null when blank or missing', () => {
    expect(normalizeDetectedEvent({ description: '' }).description).toBeNull();
    expect(normalizeDetectedEvent({ description: '   ' }).description).toBeNull();
    expect(normalizeDetectedEvent({}).description).toBeNull();
    expect(normalizeDetectedEvent({ description: null }).description).toBeNull();
  });

  it('sets time fields to null when missing or blank', () => {
    expect(normalizeDetectedEvent({}).start_time).toBeNull();
    expect(normalizeDetectedEvent({ start_time: '' }).start_time).toBeNull();
    expect(normalizeDetectedEvent({ end_time: '' }).end_time).toBeNull();
  });
});

// ─── hasExistingEvents ────────────────────────────────────────────────────────

describe('hasExistingEvents', () => {
  it('returns false for count 0 — autoCreateEvents passes 0 when only the backfill "Program Events" row exists', () => {
    // The DB query in autoCreateEvents uses .neq('name', 'Program Events') so a program
    // with only that backfill row produces count=0, which hasExistingEvents correctly maps to false.
    // (The query itself is integration-level; this verifies the pure-function side.)
    expect(hasExistingEvents(0)).toBe(false);
  });

  it('returns true when program has one or more events', () => {
    expect(hasExistingEvents(1)).toBe(true);
    expect(hasExistingEvents(5)).toBe(true);
    expect(hasExistingEvents(100)).toBe(true);
  });
});

// ─── Fixture briefs ───────────────────────────────────────────────────────────

describe('normalizeDetectedEvent — fixture briefs', () => {
  it('fixture 1 — multi-event corporate conference RFP', () => {
    const rawEvents = [
      { name: 'Welcome Reception', event_date: '2026-10-05', start_time: '18:00', end_time: '20:00', guest_count: 200, event_type: 'cocktail reception', description: null },
      { name: 'General Session Day 1', event_date: '2026-10-06', start_time: '09:00', end_time: '17:00', guest_count: 200, event_type: 'general session', description: 'Full-day keynote and breakout sessions.' },
      { name: 'Gala Dinner', event_date: '2026-10-06', start_time: '19:00', end_time: '23:00', guest_count: 200, event_type: 'dinner', description: 'Black tie awards dinner.' },
    ];
    const results = rawEvents.map(normalizeDetectedEvent);
    expect(results[0].event_type).toBe('cocktail_reception');
    expect(results[1].event_type).toBe('general_session');
    expect(results[2].event_type).toBe('formal_dinner');
    expect(results.every((r) => r.guest_count === 200)).toBe(true);
    expect(results[0].event_date).toBe('2026-10-05');
    expect(results[1].description).toBe('Full-day keynote and breakout sessions.');
    expect(results[0].description).toBeNull();
  });

  it('fixture 2 — single-event venue RFP with missing fields', () => {
    const rawEvent = {
      name: 'Awards Luncheon',
      event_date: null,
      start_time: '12:00',
      end_time: null,
      guest_count: null,
      event_type: 'luncheon',
      description: '',
    };
    const result = normalizeDetectedEvent(rawEvent);
    expect(result.name).toBe('Awards Luncheon');
    expect(result.event_type).toBe('lunch');
    expect(result.event_date).toBeNull();
    expect(result.start_time).toBe('12:00');
    expect(result.end_time).toBeNull();
    expect(result.guest_count).toBe(0);
    expect(result.description).toBeNull();
  });

  it('fixture 3 — team-building itinerary with mixed event types', () => {
    const rawEvents = [
      { name: 'Morning Yoga', event_type: 'wellness activity', guest_count: 30 },
      { name: 'Cooking Class', event_type: 'experience', guest_count: 30 },
      { name: 'Group Dinner', event_type: 'gala', guest_count: 30 },
      { name: 'City Bus Tour', event_type: 'tour', guest_count: 30 },
    ];
    const results = rawEvents.map(normalizeDetectedEvent);
    expect(results[0].event_type).toBe('custom');       // 'wellness activity' has no match
    expect(results[1].event_type).toBe('experiential'); // 'experience' → experiential
    expect(results[2].event_type).toBe('formal_dinner'); // 'gala' → formal_dinner
    expect(results[3].event_type).toBe('excursion');    // 'tour' → excursion
    expect(results.every((r) => r.guest_count === 30)).toBe(true);
  });
});

// ─── Meridian RFP fixture ─────────────────────────────────────────────────────
// Simulates the 7-event response Claude haiku produces from Meridian_RFP_Test.pdf
// (President's Club Incentive Retreat, Charleston SC, Oct 14-16 2026, 120 guests)

describe('normalizeDetectedEvent — Meridian RFP fixture', () => {
  const raw = [
    { name: 'Welcome Reception', event_date: '2026-10-14', start_time: '18:00', end_time: '20:00', guest_count: 120, event_type: 'cocktail reception', description: 'Opening networking reception for all attendees.' },
    { name: 'General Session', event_date: '2026-10-15', start_time: '09:00', end_time: '12:00', guest_count: 120, event_type: 'general session', description: 'Full morning keynote and company presentations.' },
    { name: 'Awards Gala Option A — Hotel Ballroom', event_date: '2026-10-15', start_time: '19:00', end_time: '23:00', guest_count: 120, event_type: 'dinner', description: 'Black tie awards dinner in the hotel ballroom.' },
    { name: 'Awards Gala Option B — Historic Restaurant', event_date: '2026-10-15', start_time: '19:00', end_time: '23:00', guest_count: 120, event_type: 'gala', description: 'Black tie awards dinner at a Charleston historic venue.' },
    { name: 'Charleston Harbor Cruise', event_date: '2026-10-16', start_time: '10:00', end_time: '13:00', guest_count: 80, event_type: 'excursion', description: 'Private harbor cruise for a portion of attendees.' },
    { name: 'Culinary Walking Tour', event_date: '2026-10-16', start_time: '10:00', end_time: '13:00', guest_count: 40, event_type: 'tour', description: 'Guided culinary walking tour of downtown Charleston.' },
    { name: 'Farewell Brunch', event_date: '2026-10-16', start_time: '11:00', end_time: '13:00', guest_count: 120, event_type: 'brunch', description: 'Closing farewell brunch before departure.' },
  ];

  const results = raw.map(normalizeDetectedEvent);

  it('normalizes all 7 events without error', () => {
    expect(results).toHaveLength(7);
  });

  it('maps event types correctly', () => {
    expect(results[0].event_type).toBe('cocktail_reception'); // 'cocktail reception'
    expect(results[1].event_type).toBe('general_session');   // 'general session'
    expect(results[2].event_type).toBe('formal_dinner');     // 'dinner'
    expect(results[3].event_type).toBe('formal_dinner');     // 'gala'
    expect(results[4].event_type).toBe('excursion');         // 'excursion'
    expect(results[5].event_type).toBe('excursion');         // 'tour'
    expect(results[6].event_type).toBe('breakfast');         // 'brunch'
  });

  it('preserves all event dates in YYYY-MM-DD format', () => {
    expect(results[0].event_date).toBe('2026-10-14');
    results.slice(1, 4).forEach((r) => expect(r.event_date).toBe('2026-10-15'));
    results.slice(4).forEach((r) => expect(r.event_date).toBe('2026-10-16'));
  });

  it('preserves guest counts (including split group sizes)', () => {
    expect(results[0].guest_count).toBe(120);
    expect(results[1].guest_count).toBe(120);
    expect(results[2].guest_count).toBe(120);
    expect(results[3].guest_count).toBe(120);
    expect(results[4].guest_count).toBe(80);
    expect(results[5].guest_count).toBe(40);
    expect(results[6].guest_count).toBe(120);
  });

  it('preserves event names', () => {
    expect(results[0].name).toBe('Welcome Reception');
    expect(results[2].name).toBe('Awards Gala Option A — Hotel Ballroom');
    expect(results[3].name).toBe('Awards Gala Option B — Historic Restaurant');
    expect(results[6].name).toBe('Farewell Brunch');
  });

  it('preserves descriptions', () => {
    results.forEach((r) => expect(r.description).not.toBeNull());
    expect(results[4].description).toBe('Private harbor cruise for a portion of attendees.');
  });

  it('preserves start and end times', () => {
    expect(results[0].start_time).toBe('18:00');
    expect(results[0].end_time).toBe('20:00');
    expect(results[6].start_time).toBe('11:00');
    expect(results[6].end_time).toBe('13:00');
  });
});

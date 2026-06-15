// server-free pure functions for event detection from RFP/brief documents

export const EVENT_TYPE_VALUES = [
  'logistics',
  'general_session',
  'formal_dinner',
  'experiential',
  'excursion',
  'cocktail_reception',
  'dine_around',
  'breakfast',
  'lunch',
  'custom',
] as const;

export type EventTypeValue = (typeof EVENT_TYPE_VALUES)[number];

export interface DetectedEvent {
  name: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_count: number;
  event_type: EventTypeValue;
  description: string | null;
}

const EVENT_TYPE_ALIASES: Record<string, EventTypeValue> = {
  logistics: 'logistics',
  'general session': 'general_session',
  general_session: 'general_session',
  keynote: 'general_session',
  plenary: 'general_session',
  'formal dinner': 'formal_dinner',
  formal_dinner: 'formal_dinner',
  dinner: 'formal_dinner',
  gala: 'formal_dinner',
  banquet: 'formal_dinner',
  experiential: 'experiential',
  experience: 'experiential',
  excursion: 'excursion',
  tour: 'excursion',
  'cocktail reception': 'cocktail_reception',
  cocktail_reception: 'cocktail_reception',
  cocktail: 'cocktail_reception',
  reception: 'cocktail_reception',
  'dine around': 'dine_around',
  dine_around: 'dine_around',
  'restaurant dine around': 'dine_around',
  breakfast: 'breakfast',
  brunch: 'breakfast',
  lunch: 'lunch',
  luncheon: 'lunch',
  custom: 'custom',
};

// Maps a raw string → enum value; defaults to 'custom' on no match, never throws.
export function normalizeEventType(raw: unknown): EventTypeValue {
  if (!raw || typeof raw !== 'string') return 'custom';
  const lower = raw.toLowerCase().trim();
  if (lower in EVENT_TYPE_ALIASES) return EVENT_TYPE_ALIASES[lower];
  if ((EVENT_TYPE_VALUES as readonly string[]).includes(lower)) return lower as EventTypeValue;
  for (const [alias, value] of Object.entries(EVENT_TYPE_ALIASES)) {
    if (lower.includes(alias)) return value;
  }
  return 'custom';
}

// Normalizes a raw (unknown-typed) API response object → DetectedEvent.
// Every field defaults safely — never throws on bad input.
export function normalizeDetectedEvent(raw: unknown): DetectedEvent {
  if (!raw || typeof raw !== 'object') {
    return { name: 'Event', event_date: null, start_time: null, end_time: null, guest_count: 0, event_type: 'custom', description: null };
  }
  const r = raw as Record<string, unknown>;
  return {
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Event',
    event_date:
      typeof r.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.event_date)
        ? r.event_date
        : null,
    start_time: typeof r.start_time === 'string' && r.start_time.trim() ? r.start_time.trim() : null,
    end_time: typeof r.end_time === 'string' && r.end_time.trim() ? r.end_time.trim() : null,
    guest_count:
      typeof r.guest_count === 'number' && Number.isFinite(r.guest_count) && r.guest_count >= 0
        ? Math.floor(r.guest_count)
        : 0,
    event_type: normalizeEventType(r.event_type),
    description:
      typeof r.description === 'string' && r.description.trim() ? r.description.trim() : null,
  };
}

// Pure duplicate guard — check before calling autoCreateEvents.
export function hasExistingEvents(existingCount: number): boolean {
  return existingCount > 0;
}

export function buildDetectEventsPrompt(): string {
  return (
    'Read this event brief or RFP and identify each distinct event or activity session within it. ' +
    'Return ONLY a JSON array of event objects — no markdown, no explanation. ' +
    'Each object must have: ' +
    '"name" (descriptive event name, e.g. "Welcome Reception", "Gala Dinner", "City Tour"), ' +
    '"event_date" (YYYY-MM-DD if found, otherwise null), ' +
    '"start_time" (HH:MM 24-hour if found, otherwise null), ' +
    '"end_time" (HH:MM 24-hour if found, otherwise null), ' +
    '"guest_count" (integer, 0 if not specified), ' +
    '"event_type" (one of: logistics, general_session, formal_dinner, experiential, excursion, ' +
    'cocktail_reception, dine_around, breakfast, lunch, custom), ' +
    '"description" (1 sentence summary or null). ' +
    'If the document describes only a single event, return an array with one item. ' +
    'Include only real events — not internal logistics notes or placeholder text. ' +
    'Return an empty array [] if no events can be identified.'
  );
}

// Shared types for the Generate Deck feature.
// NO next/headers, NO supabase/server — safe to import from client components.

import { z } from 'zod';
import type { DeckContract } from '../contracts/deckContract';

// ─── Narrative ────────────────────────────────────────────────────────────────

// Text-only context passed to the narrative AI — no dollar figures ever.
export interface NarrativeInput {
  estimateType: string;
  estimateName: string;
  programName: string;
  clientName: string | null;
  venueName: string | null;
  venueCity: string | null;
  eventType: string | null;
  guestCount: number;
  sectionNames: string[];
}

// All text fields, zero numeric fields.
// Structural guarantee: the model cannot emit a price into this schema.
export const NarrativeOutputSchema = z.object({
  headline: z.string(),
  intro: z.string(),
  venueSummary: z.string(),
  experienceSummary: z.string(),
  sectionDescriptions: z.record(z.string()),
  closingNote: z.string(),
});

export type NarrativeOutput = z.infer<typeof NarrativeOutputSchema>;

export function defaultNarrative(input: NarrativeInput): NarrativeOutput {
  const type = input.estimateType === 'venue' ? 'venue experience'
    : input.estimateType === 'av' ? 'AV & production'
    : input.estimateType === 'decor' ? 'décor & design'
    : input.estimateType === 'tour' ? 'tour experience'
    : input.estimateType;

  const intro = [
    input.programName,
    input.clientName ? `for ${input.clientName}` : null,
    '—',
    `a ${type}`,
    input.venueCity ? `in ${input.venueCity}` : null,
    `for ${input.guestCount} guests.`,
  ].filter(Boolean).join(' ');

  return {
    headline: input.estimateName,
    intro,
    venueSummary: input.venueName ?? '',
    experienceSummary: 'An expertly crafted event experience tailored to your team.',
    sectionDescriptions: Object.fromEntries(input.sectionNames.map((s) => [s, ''])),
    closingNote: 'We look forward to creating a memorable experience for your group.',
  };
}

// ─── Renderer request / response ──────────────────────────────────────────────

// One slide = one estimate contract + its narrative copy.
export interface DeckRenderSlide {
  contract: DeckContract;
  narrative: NarrativeOutput;
}

// Sent to the deck-renderer service over HTTP.
export interface DeckRenderRequest {
  slides: DeckRenderSlide[];
}

// Returned by the deck-renderer service.
export interface DeckRenderResponse {
  pdf: string; // base64-encoded PDF bytes
}

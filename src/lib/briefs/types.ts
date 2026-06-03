// Server-free types for the Onsite Brief feature.
// Client components import from here — never from queries.ts.

export const BRIEF_SECTIONS = [
  'eventBasics',
  'venueContact',
  'financialDetails',
  'menuBar',
  'dietaryRestrictions',
  'transportation',
  'dayOfLogistics',
  'contractTerms',
  'openItems',
  'summary',
] as const;

export type BriefSectionKey = typeof BRIEF_SECTIONS[number];

export const BRIEF_SECTION_LABELS: Record<BriefSectionKey, string> = {
  eventBasics:          'Event Basics',
  venueContact:         'Restaurant / Venue Contact',
  financialDetails:     'Financial Details',
  menuBar:              'Menu & Bar',
  dietaryRestrictions:  'Dietary Restrictions',
  transportation:       'Transportation',
  dayOfLogistics:       'Day-of Logistics',
  contractTerms:        'Contract Terms',
  openItems:            'Open Items',
  summary:              'Plain-Language Summary',
};

// Which sections are AI-synthesized vs. pulled from structured data
export const AI_SECTIONS: Set<BriefSectionKey> = new Set([
  'menuBar',
  'dietaryRestrictions',
  'dayOfLogistics',
  'contractTerms',
  'openItems',
  'summary',
]);

export interface BriefSection {
  /** Rendered content — either plain text or a JSON blob for structured sections */
  content: string;
  /** True when this section was AI-synthesized and has not been manually confirmed */
  isAiDraft: boolean;
  /** Human-readable source hint, e.g. "from contract.pdf" */
  sourceHint?: string;
  /** ISO timestamp of last manual edit */
  lastEditedAt?: string;
}

export type BriefContent = Record<BriefSectionKey, BriefSection>;

export interface ProgramBrief {
  id: string;
  program_id: string;
  content: BriefContent;
  section_owners: Record<BriefSectionKey, number | null>; // team_member_id
  generated_at: string;
  last_edited_at: string;
}

export function emptyBrief(): BriefContent {
  return Object.fromEntries(
    BRIEF_SECTIONS.map(key => [key, {
      content: '',
      isAiDraft: AI_SECTIONS.has(key),
      sourceHint: undefined,
      lastEditedAt: undefined,
    }])
  ) as BriefContent;
}

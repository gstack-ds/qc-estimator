import type { LeadStatus } from '@/lib/leads/constants';

export interface PipelineLane {
  id: string;
  label: string;
  /** Status assigned when a card is dropped into this lane */
  canonicalStatus: LeadStatus;
  /** All statuses that display in this lane */
  statuses: LeadStatus[];
  /** Tailwind color for the lane accent / status dot */
  color: string;
}

// ─── 10-lane pipeline ──────────────────────────────────────
//
// No migration required for post_event_close_out or unresponsive — they
// already exist in the enum.  New values added in migration 035:
//   tracking_on_hold, negotiations
//
// Migration 035 data remaps:
//   halted             → tracking_on_hold
//   planning           → under_contract
//   planning_not_started → under_contract
//
// Legacy status fallbacks (for any rows that slipped through the migration):
//   halted / planning / planning_not_started still mapped below.
//   unresponsive → did_not_book (unchanged).

export const PIPELINE_LANES: PipelineLane[] = [
  {
    id: 'tracking_on_hold',
    label: 'Tracking / On Hold',
    canonicalStatus: 'tracking_on_hold',
    statuses: ['tracking_on_hold', 'halted'],
    color: 'indigo',
  },
  {
    id: 'new_lead',
    label: 'New Lead',
    canonicalStatus: 'new_lead',
    statuses: ['new_lead'],
    color: 'blue',
  },
  {
    id: 'proposal',
    label: 'Proposal in Progress',
    canonicalStatus: 'proposal_in_progress',
    statuses: ['proposal_in_progress'],
    color: 'amber',
  },
  {
    id: 'pending_client_review',
    label: 'Pending Client Review',
    canonicalStatus: 'pending_client_review',
    statuses: ['pending_client_review'],
    color: 'purple',
  },
  {
    id: 'negotiations',
    label: 'Negotiations',
    canonicalStatus: 'negotiations',
    statuses: ['negotiations'],
    color: 'rose',
  },
  {
    id: 'pending_signature_payment',
    label: 'Pending Signature/Payment',
    canonicalStatus: 'pending_contract_payment',
    statuses: ['pending_contract_payment'],
    color: 'orange',
  },
  {
    id: 'under_contract',
    label: 'Under Contract',
    canonicalStatus: 'under_contract',
    statuses: ['under_contract', 'planning', 'planning_not_started'],
    color: 'green',
  },
  {
    id: 'post_event_close_out',
    label: 'Post Event Close Out',
    canonicalStatus: 'post_event_close_out',
    statuses: ['post_event_close_out'],
    color: 'teal',
  },
  {
    id: 'completed',
    label: 'Completed',
    canonicalStatus: 'completed',
    statuses: ['completed'],
    color: 'emerald',
  },
  {
    id: 'did_not_book',
    label: 'Did Not Book',
    canonicalStatus: 'did_not_book',
    statuses: ['did_not_book', 'unresponsive'],
    color: 'slate',
  },
];

// Build a fast lookup map: status → lane ID
const STATUS_TO_LANE_ID = new Map<LeadStatus, string>(
  PIPELINE_LANES.flatMap(lane => lane.statuses.map(s => [s, lane.id] as [LeadStatus, string]))
);

/**
 * Returns the lane ID for a given lead status.
 * Falls back to 'did_not_book' for any unmapped status (safety net).
 */
export function statusToLaneId(status: LeadStatus): string {
  return STATUS_TO_LANE_ID.get(status) ?? 'did_not_book';
}

/**
 * Returns the lane for a given lead status.
 */
export function statusToLane(status: LeadStatus): PipelineLane | undefined {
  const id = statusToLaneId(status);
  return PIPELINE_LANES.find(l => l.id === id);
}

/**
 * Returns the lane with the given ID.
 */
export function getLane(laneId: string): PipelineLane | undefined {
  return PIPELINE_LANES.find(l => l.id === laneId);
}

// ─── Per-lane style lookup ────────────────────────────────
//
// ALL class strings are explicit literals so Tailwind's JIT scanner
// includes every class in the production build regardless of which
// lane is active at runtime. Never construct classes dynamically.

export interface LaneStyles {
  dot: string;
  headerBorder: string;
  cardBg: string;
  cardBorder: string;
}

export const LANE_STYLES: Record<string, LaneStyles> = {
  tracking_on_hold: {
    dot:          'bg-indigo-500',
    headerBorder: 'border-t-indigo-400',
    cardBg:       'bg-indigo-50',
    cardBorder:   'border-l-indigo-400',
  },
  new_lead: {
    dot:          'bg-blue-500',
    headerBorder: 'border-t-blue-400',
    cardBg:       'bg-blue-50',
    cardBorder:   'border-l-blue-400',
  },
  proposal: {
    dot:          'bg-amber-500',
    headerBorder: 'border-t-amber-400',
    cardBg:       'bg-amber-50',
    cardBorder:   'border-l-amber-400',
  },
  pending_client_review: {
    dot:          'bg-purple-500',
    headerBorder: 'border-t-purple-400',
    cardBg:       'bg-purple-50',
    cardBorder:   'border-l-purple-400',
  },
  negotiations: {
    dot:          'bg-rose-500',
    headerBorder: 'border-t-rose-400',
    cardBg:       'bg-rose-50',
    cardBorder:   'border-l-rose-400',
  },
  pending_signature_payment: {
    dot:          'bg-orange-500',
    headerBorder: 'border-t-orange-400',
    cardBg:       'bg-orange-50',
    cardBorder:   'border-l-orange-400',
  },
  under_contract: {
    dot:          'bg-green-500',
    headerBorder: 'border-t-green-500',
    cardBg:       'bg-green-50',
    cardBorder:   'border-l-green-500',
  },
  post_event_close_out: {
    dot:          'bg-teal-500',
    headerBorder: 'border-t-teal-500',
    cardBg:       'bg-teal-50',
    cardBorder:   'border-l-teal-500',
  },
  completed: {
    dot:          'bg-emerald-500',
    headerBorder: 'border-t-emerald-500',
    cardBg:       'bg-emerald-50',
    cardBorder:   'border-l-emerald-500',
  },
  did_not_book: {
    dot:          'bg-slate-400',
    headerBorder: 'border-t-slate-400',
    cardBg:       'bg-slate-50',
    cardBorder:   'border-l-slate-400',
  },
};

const FALLBACK_STYLES: LaneStyles = {
  dot:          'bg-slate-400',
  headerBorder: 'border-t-slate-400',
  cardBg:       'bg-slate-50',
  cardBorder:   'border-l-slate-400',
};

export function laneStyles(laneId: string): LaneStyles {
  return LANE_STYLES[laneId] ?? FALLBACK_STYLES;
}

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

// ─── 7-lane pipeline ──────────────────────────────────────
//
// No migration required — all 12 LeadStatus enum values already exist.
// Enum values: new_lead, proposal_in_progress, pending_client_review,
//   pending_contract_payment, under_contract, planning, unresponsive,
//   post_event_close_out, halted, planning_not_started, did_not_book, completed.
//
// Status → lane reconciliation:
//   pending_contract_payment → Pending Client Review (waiting for client action before contract)
//   planning_not_started     → Planning (same stage, not yet begun)
//   post_event_close_out     → Planning (final active-work phase)
//   unresponsive             → Did Not Book (stalled; client unreachable)
//   halted                   → Did Not Book (stopped before close)
//
// Cards can move between any lanes in either direction.

export const PIPELINE_LANES: PipelineLane[] = [
  {
    id: 'new_lead',
    label: 'New Lead',
    canonicalStatus: 'new_lead',
    statuses: ['new_lead'],
    color: 'blue',
  },
  {
    id: 'proposal',
    label: 'Proposal',
    canonicalStatus: 'proposal_in_progress',
    statuses: ['proposal_in_progress'],
    color: 'amber',
  },
  {
    id: 'pending_client_review',
    label: 'Pending Client Review',
    canonicalStatus: 'pending_client_review',
    // pending_contract_payment: client reviewing before signing/paying
    statuses: ['pending_client_review', 'pending_contract_payment'],
    color: 'orange',
  },
  {
    id: 'under_contract',
    label: 'Under Contract',
    canonicalStatus: 'under_contract',
    statuses: ['under_contract'],
    color: 'green',
  },
  {
    id: 'planning',
    label: 'Planning',
    canonicalStatus: 'planning',
    statuses: ['planning', 'planning_not_started', 'post_event_close_out'],
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
    // unresponsive + halted: dead/stalled deals that didn't convert
    statuses: ['did_not_book', 'unresponsive', 'halted'],
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

// Dot color classes per lane color
export const LANE_DOT_CLASSES: Record<string, string> = {
  blue:    'bg-blue-400',
  amber:   'bg-amber-400',
  orange:  'bg-orange-400',
  green:   'bg-green-500',
  teal:    'bg-teal-500',
  emerald: 'bg-emerald-500',
  slate:   'bg-slate-400',
};

export const LANE_ACCENT_CLASSES: Record<string, string> = {
  blue:    'border-t-blue-400',
  amber:   'border-t-amber-400',
  orange:  'border-t-orange-400',
  green:   'border-t-green-500',
  teal:    'border-t-teal-500',
  emerald: 'border-t-emerald-500',
  slate:   'border-t-slate-400',
};

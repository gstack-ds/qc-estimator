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

export const PIPELINE_LANES: PipelineLane[] = [
  {
    id: 'new_lead',
    label: 'New Lead',
    canonicalStatus: 'new_lead',
    statuses: ['new_lead'],
    color: 'blue',
  },
  {
    id: 'proposal_in_progress',
    label: 'Proposal in Progress',
    canonicalStatus: 'proposal_in_progress',
    statuses: ['proposal_in_progress'],
    color: 'amber',
  },
  {
    id: 'pending_client_review',
    label: 'Pending Client Review',
    canonicalStatus: 'pending_client_review',
    // pending_contract_payment is at the same review/approval stage
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
    // planning_not_started is at the planning stage (just hasn't begun)
    // post_event_close_out is the final active phase of a program
    statuses: ['planning', 'planning_not_started', 'post_event_close_out'],
    color: 'teal',
  },
  {
    id: 'inactive',
    label: 'Inactive / Saved',
    canonicalStatus: 'halted',
    // unresponsive, halted = paused; did_not_book, completed = closed
    statuses: ['unresponsive', 'halted', 'did_not_book', 'completed'],
    color: 'slate',
  },
];

// Build a fast lookup map: status → lane
const STATUS_TO_LANE_ID = new Map<LeadStatus, string>(
  PIPELINE_LANES.flatMap(lane => lane.statuses.map(s => [s, lane.id] as [LeadStatus, string]))
);

/**
 * Returns the lane ID for a given lead status.
 * Falls back to 'inactive' for any unmapped status (should not happen with current 12 values).
 */
export function statusToLaneId(status: LeadStatus): string {
  return STATUS_TO_LANE_ID.get(status) ?? 'inactive';
}

/**
 * Returns the lane for a given lead status, or null if unmapped.
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
  blue:   'bg-blue-400',
  amber:  'bg-amber-400',
  orange: 'bg-orange-400',
  green:  'bg-green-500',
  teal:   'bg-teal-500',
  slate:  'bg-slate-400',
};

export const LANE_ACCENT_CLASSES: Record<string, string> = {
  blue:   'border-t-blue-400',
  amber:  'border-t-amber-400',
  orange: 'border-t-orange-400',
  green:  'border-t-green-500',
  teal:   'border-t-teal-500',
  slate:  'border-t-slate-400',
};

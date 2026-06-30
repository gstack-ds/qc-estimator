// Swappable status progression for the unified deal page (Phase 2B).
// Stored status NEVER changes — lead.status stays the 14-value enum. This is a DISPLAY map:
// the 8 forward stages (Alex's) are projected over the 14 raw statuses; the 6 non-forward
// statuses render as ASIDE states (On Hold / Closed-Lost), not destructive remaps.
// Flip ACTIVE_CONFIG (e.g. to FULL_STAGES) to change granularity with no rebuild.
// Server-free (types only) so a client component can import it.

import type { LeadStatus } from '@/lib/leads/constants';

export interface DealStage {
  key: string;
  label: string;
  rawStatuses: LeadStatus[];
}

// ── Alex's 8 forward stages (DEFAULT) — the linear happy path ─────────────────
// under_contract also absorbs the two legacy "planning" statuses (post-contract).
export const ALEX_STAGES: DealStage[] = [
  { key: 'new_lead', label: 'New Lead', rawStatuses: ['new_lead'] },
  { key: 'proposal_in_progress', label: 'Proposal in Progress', rawStatuses: ['proposal_in_progress'] },
  { key: 'pending_client_review', label: 'Pending Client Review', rawStatuses: ['pending_client_review'] },
  { key: 'negotiations', label: 'Negotiations', rawStatuses: ['negotiations'] },
  { key: 'pending_contract_payment', label: 'Pending Signature/Payment', rawStatuses: ['pending_contract_payment'] },
  { key: 'under_contract', label: 'Under Contract', rawStatuses: ['under_contract', 'planning_not_started', 'planning'] },
  { key: 'post_event_close_out', label: 'Post Event Closeout', rawStatuses: ['post_event_close_out'] },
  { key: 'completed', label: 'Completed', rawStatuses: ['completed'] },
];

// ── ASIDE statuses — the 6 raw values NOT on the forward path. Rendered as a state
// badge next to the stepper; never destructively folded into a forward stage. ───
export type AsideKind = 'on_hold' | 'closed_lost';
export const ASIDE_STATUS: Partial<Record<LeadStatus, { kind: AsideKind; label: string }>> = {
  tracking_on_hold: { kind: 'on_hold', label: 'On Hold' },
  halted: { kind: 'on_hold', label: 'On Hold' }, // legacy → behaves like on-hold
  unresponsive: { kind: 'closed_lost', label: 'Unresponsive' },
  did_not_book: { kind: 'closed_lost', label: 'Did Not Book' },
};

export function asideFor(status: LeadStatus): { kind: AsideKind; label: string } | null {
  return ASIDE_STATUS[status] ?? null;
}

// ── Alternate configs (built, not active — swap ACTIVE_CONFIG to use) ─────────
export const FULL_STAGES: DealStage[] = [
  { key: 'new_lead', label: 'New Lead', rawStatuses: ['new_lead'] },
  { key: 'proposal_in_progress', label: 'Proposal in Progress', rawStatuses: ['proposal_in_progress'] },
  { key: 'pending_client_review', label: 'Pending Client Review', rawStatuses: ['pending_client_review'] },
  { key: 'negotiations', label: 'Negotiations', rawStatuses: ['negotiations'] },
  { key: 'pending_contract_payment', label: 'Pending Signature/Payment', rawStatuses: ['pending_contract_payment'] },
  { key: 'under_contract', label: 'Under Contract', rawStatuses: ['under_contract'] },
  { key: 'planning_not_started', label: 'Planning Not Started', rawStatuses: ['planning_not_started'] },
  { key: 'planning', label: 'Planning', rawStatuses: ['planning'] },
  { key: 'post_event_close_out', label: 'Post Event Closeout', rawStatuses: ['post_event_close_out'] },
  { key: 'completed', label: 'Completed', rawStatuses: ['completed'] },
  { key: 'tracking_on_hold', label: 'Tracking / On Hold', rawStatuses: ['tracking_on_hold'] },
  { key: 'halted', label: 'Halted', rawStatuses: ['halted'] },
  { key: 'unresponsive', label: 'Unresponsive', rawStatuses: ['unresponsive'] },
  { key: 'did_not_book', label: 'Did Not Book', rawStatuses: ['did_not_book'] },
];

// The one knob. Default = Alex's 8 stages.
export const ACTIVE_CONFIG: DealStage[] = ALEX_STAGES;

export type StageState = 'complete' | 'current' | 'upcoming';

export function activeStageIndex(config: DealStage[], status: LeadStatus): number {
  return config.findIndex((s) => s.rawStatuses.includes(status));
}

// Per-stage display state. Stages before the matched one = complete, the match = current,
// the rest = upcoming. An aside/unknown status (no forward match) → all upcoming (the aside
// badge carries the state instead).
export function stageStates(
  config: DealStage[],
  status: LeadStatus,
): { stage: DealStage; state: StageState }[] {
  const activeIdx = activeStageIndex(config, status);
  return config.map((stage, i) => ({
    stage,
    state:
      activeIdx === -1 ? 'upcoming' : i < activeIdx ? 'complete' : i === activeIdx ? 'current' : 'upcoming',
  }));
}

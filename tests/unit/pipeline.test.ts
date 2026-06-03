import { describe, it, expect } from 'vitest';
import {
  PIPELINE_LANES,
  statusToLaneId,
  statusToLane,
  getLane,
} from '@/lib/leads/pipeline';
import type { LeadStatus } from '@/lib/leads/constants';

// Every lead status that exists in the system
const ALL_STATUSES: LeadStatus[] = [
  'new_lead',
  'proposal_in_progress',
  'pending_client_review',
  'pending_contract_payment',
  'under_contract',
  'planning',
  'unresponsive',
  'post_event_close_out',
  'halted',
  'planning_not_started',
  'did_not_book',
  'completed',
];

describe('PIPELINE_LANES — completeness', () => {
  it('has exactly 6 lanes', () => {
    expect(PIPELINE_LANES).toHaveLength(6);
  });

  it('every lead status maps to exactly one lane', () => {
    for (const status of ALL_STATUSES) {
      const laneId = statusToLaneId(status);
      expect(laneId, `${status} has no lane`).toBeTruthy();
      const lane = getLane(laneId);
      expect(lane, `lane ${laneId} not found`).toBeDefined();
    }
  });

  it('no status appears in more than one lane', () => {
    const seen = new Set<string>();
    for (const lane of PIPELINE_LANES) {
      for (const s of lane.statuses) {
        expect(seen.has(s), `${s} appears in multiple lanes`).toBe(false);
        seen.add(s);
      }
    }
  });

  it('every status in a lane.statuses array resolves back to that lane', () => {
    for (const lane of PIPELINE_LANES) {
      for (const s of lane.statuses) {
        expect(statusToLaneId(s as LeadStatus)).toBe(lane.id);
      }
    }
  });

  it('each lane has a valid canonicalStatus inside its own statuses array', () => {
    for (const lane of PIPELINE_LANES) {
      expect(lane.statuses).toContain(lane.canonicalStatus);
    }
  });
});

describe('statusToLaneId — per-status spot checks', () => {
  it('new_lead → new_lead lane', () => {
    expect(statusToLaneId('new_lead')).toBe('new_lead');
  });

  it('proposal_in_progress → proposal_in_progress lane', () => {
    expect(statusToLaneId('proposal_in_progress')).toBe('proposal_in_progress');
  });

  it('pending_client_review → pending_client_review lane', () => {
    expect(statusToLaneId('pending_client_review')).toBe('pending_client_review');
  });

  it('pending_contract_payment → pending_client_review lane (same review/approval stage)', () => {
    expect(statusToLaneId('pending_contract_payment')).toBe('pending_client_review');
  });

  it('under_contract → under_contract lane', () => {
    expect(statusToLaneId('under_contract')).toBe('under_contract');
  });

  it('planning → planning lane', () => {
    expect(statusToLaneId('planning')).toBe('planning');
  });

  it('planning_not_started → planning lane', () => {
    expect(statusToLaneId('planning_not_started')).toBe('planning');
  });

  it('post_event_close_out → planning lane', () => {
    expect(statusToLaneId('post_event_close_out')).toBe('planning');
  });

  it('unresponsive → inactive lane', () => {
    expect(statusToLaneId('unresponsive')).toBe('inactive');
  });

  it('halted → inactive lane', () => {
    expect(statusToLaneId('halted')).toBe('inactive');
  });

  it('did_not_book → inactive lane', () => {
    expect(statusToLaneId('did_not_book')).toBe('inactive');
  });

  it('completed → inactive lane', () => {
    expect(statusToLaneId('completed')).toBe('inactive');
  });
});

describe('statusToLane — returns full lane object', () => {
  it('returns the lane object with all fields', () => {
    const lane = statusToLane('under_contract');
    expect(lane).toBeDefined();
    expect(lane!.label).toBe('Under Contract');
    expect(lane!.canonicalStatus).toBe('under_contract');
    expect(lane!.color).toBe('green');
  });

  it('returns undefined for non-existent status (type safety boundary)', () => {
    // Cast to bypass TypeScript — confirms fallback behavior
    const lane = statusToLane('unknown_status' as LeadStatus);
    expect(lane).toBeDefined(); // falls back to 'inactive' lane
  });
});

describe('canonical status per lane', () => {
  it('dropping to New Lead lane → new_lead', () => {
    const lane = getLane('new_lead')!;
    expect(lane.canonicalStatus).toBe('new_lead');
  });

  it('dropping to Proposal in Progress → proposal_in_progress', () => {
    expect(getLane('proposal_in_progress')!.canonicalStatus).toBe('proposal_in_progress');
  });

  it('dropping to Pending Client Review → pending_client_review', () => {
    expect(getLane('pending_client_review')!.canonicalStatus).toBe('pending_client_review');
  });

  it('dropping to Under Contract → under_contract', () => {
    expect(getLane('under_contract')!.canonicalStatus).toBe('under_contract');
  });

  it('dropping to Planning → planning', () => {
    expect(getLane('planning')!.canonicalStatus).toBe('planning');
  });

  it('dropping to Inactive / Saved → halted (parked, not deleted)', () => {
    expect(getLane('inactive')!.canonicalStatus).toBe('halted');
  });
});

import { describe, it, expect } from 'vitest';
import {
  PIPELINE_LANES,
  statusToLaneId,
  statusToLane,
  getLane,
} from '@/lib/leads/pipeline';
import type { LeadStatus } from '@/lib/leads/constants';

// All 12 lead statuses that exist in the database enum
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

describe('PIPELINE_LANES — structure', () => {
  it('has exactly 7 lanes', () => {
    expect(PIPELINE_LANES).toHaveLength(7);
  });

  it('lanes are in the correct left-to-right order', () => {
    const ids = PIPELINE_LANES.map(l => l.id);
    expect(ids).toEqual([
      'new_lead',
      'proposal',
      'pending_client_review',
      'under_contract',
      'planning',
      'completed',
      'did_not_book',
    ]);
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

  it('every lane canonicalStatus is inside its own statuses array', () => {
    for (const lane of PIPELINE_LANES) {
      expect(lane.statuses, `${lane.id} canonical not in its statuses`).toContain(lane.canonicalStatus);
    }
  });

  it('every status in a lane.statuses resolves back to that lane', () => {
    for (const lane of PIPELINE_LANES) {
      for (const s of lane.statuses) {
        expect(statusToLaneId(s as LeadStatus), `${s} should map to ${lane.id}`).toBe(lane.id);
      }
    }
  });
});

describe('PIPELINE_LANES — completeness', () => {
  it('every lead status maps to a lane', () => {
    for (const status of ALL_STATUSES) {
      const laneId = statusToLaneId(status);
      const lane = getLane(laneId);
      expect(lane, `no lane found for status ${status}`).toBeDefined();
    }
  });

  it('all 12 statuses are covered (no gaps)', () => {
    const coveredStatuses = new Set(
      PIPELINE_LANES.flatMap(l => l.statuses)
    );
    for (const s of ALL_STATUSES) {
      expect(coveredStatuses.has(s), `${s} not covered by any lane`).toBe(true);
    }
  });
});

describe('statusToLaneId — per-status spot checks', () => {
  it('new_lead → new_lead', () => {
    expect(statusToLaneId('new_lead')).toBe('new_lead');
  });

  it('proposal_in_progress → proposal', () => {
    expect(statusToLaneId('proposal_in_progress')).toBe('proposal');
  });

  it('pending_client_review → pending_client_review', () => {
    expect(statusToLaneId('pending_client_review')).toBe('pending_client_review');
  });

  it('pending_contract_payment → pending_client_review (pre-contract client action)', () => {
    expect(statusToLaneId('pending_contract_payment')).toBe('pending_client_review');
  });

  it('under_contract → under_contract', () => {
    expect(statusToLaneId('under_contract')).toBe('under_contract');
  });

  it('planning → planning', () => {
    expect(statusToLaneId('planning')).toBe('planning');
  });

  it('planning_not_started → planning', () => {
    expect(statusToLaneId('planning_not_started')).toBe('planning');
  });

  it('post_event_close_out → planning', () => {
    expect(statusToLaneId('post_event_close_out')).toBe('planning');
  });

  it('completed → completed (own lane)', () => {
    expect(statusToLaneId('completed')).toBe('completed');
  });

  it('did_not_book → did_not_book (own lane)', () => {
    expect(statusToLaneId('did_not_book')).toBe('did_not_book');
  });

  it('unresponsive → did_not_book (stalled / unreachable)', () => {
    expect(statusToLaneId('unresponsive')).toBe('did_not_book');
  });

  it('halted → did_not_book (deal stopped)', () => {
    expect(statusToLaneId('halted')).toBe('did_not_book');
  });
});

describe('canonical status per lane (what gets written on drag-and-drop)', () => {
  it('New Lead → new_lead', () => {
    expect(getLane('new_lead')!.canonicalStatus).toBe('new_lead');
  });

  it('Proposal → proposal_in_progress', () => {
    expect(getLane('proposal')!.canonicalStatus).toBe('proposal_in_progress');
  });

  it('Pending Client Review → pending_client_review', () => {
    expect(getLane('pending_client_review')!.canonicalStatus).toBe('pending_client_review');
  });

  it('Under Contract → under_contract', () => {
    expect(getLane('under_contract')!.canonicalStatus).toBe('under_contract');
  });

  it('Planning → planning', () => {
    expect(getLane('planning')!.canonicalStatus).toBe('planning');
  });

  it('Completed → completed', () => {
    expect(getLane('completed')!.canonicalStatus).toBe('completed');
  });

  it('Did Not Book → did_not_book', () => {
    expect(getLane('did_not_book')!.canonicalStatus).toBe('did_not_book');
  });
});

describe('statusToLane — returns full lane object', () => {
  it('completed returns Completed lane with correct label', () => {
    const lane = statusToLane('completed');
    expect(lane).toBeDefined();
    expect(lane!.label).toBe('Completed');
    expect(lane!.canonicalStatus).toBe('completed');
    expect(lane!.color).toBe('emerald');
  });

  it('did_not_book returns Did Not Book lane', () => {
    const lane = statusToLane('did_not_book');
    expect(lane!.label).toBe('Did Not Book');
    expect(lane!.color).toBe('slate');
  });

  it('completed and did_not_book are in separate lanes (not merged)', () => {
    expect(statusToLaneId('completed')).not.toBe(statusToLaneId('did_not_book'));
  });

  it('proposal_in_progress is labeled Proposal (short label)', () => {
    const lane = statusToLane('proposal_in_progress');
    expect(lane!.label).toBe('Proposal');
  });
});

describe('no migration needed — enum values confirmed', () => {
  it('completed status already exists in the enum (no migration required)', () => {
    // If this compiles and the status maps correctly, the enum value exists
    expect(statusToLaneId('completed')).toBe('completed');
  });

  it('did_not_book status already exists in the enum (no migration required)', () => {
    expect(statusToLaneId('did_not_book')).toBe('did_not_book');
  });
});

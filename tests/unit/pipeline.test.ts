import { describe, it, expect } from 'vitest';
import {
  PIPELINE_LANES,
  statusToLaneId,
  statusToLane,
  getLane,
} from '@/lib/leads/pipeline';
import type { LeadStatus } from '@/lib/leads/constants';

// All lead statuses — active + legacy (legacy values still exist in enum after migration 035)
const ALL_STATUSES: LeadStatus[] = [
  'tracking_on_hold',
  'new_lead',
  'proposal_in_progress',
  'pending_client_review',
  'negotiations',
  'pending_contract_payment',
  'under_contract',
  'post_event_close_out',
  'unresponsive',
  'halted',
  'planning',
  'planning_not_started',
  'did_not_book',
  'completed',
];

describe('PIPELINE_LANES — structure', () => {
  it('has exactly 10 lanes', () => {
    expect(PIPELINE_LANES).toHaveLength(10);
  });

  it('lanes are in the correct left-to-right order', () => {
    const ids = PIPELINE_LANES.map(l => l.id);
    expect(ids).toEqual([
      'tracking_on_hold',
      'new_lead',
      'proposal',
      'pending_client_review',
      'negotiations',
      'pending_signature_payment',
      'under_contract',
      'post_event_close_out',
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

  it('all statuses are covered (no gaps)', () => {
    const coveredStatuses = new Set(
      PIPELINE_LANES.flatMap(l => l.statuses)
    );
    for (const s of ALL_STATUSES) {
      expect(coveredStatuses.has(s), `${s} not covered by any lane`).toBe(true);
    }
  });
});

describe('statusToLaneId — per-status spot checks', () => {
  it('tracking_on_hold → tracking_on_hold (own lane)', () => {
    expect(statusToLaneId('tracking_on_hold')).toBe('tracking_on_hold');
  });

  it('new_lead → new_lead', () => {
    expect(statusToLaneId('new_lead')).toBe('new_lead');
  });

  it('proposal_in_progress → proposal', () => {
    expect(statusToLaneId('proposal_in_progress')).toBe('proposal');
  });

  it('pending_client_review → pending_client_review', () => {
    expect(statusToLaneId('pending_client_review')).toBe('pending_client_review');
  });

  it('negotiations → negotiations (own lane)', () => {
    expect(statusToLaneId('negotiations')).toBe('negotiations');
  });

  it('pending_contract_payment → pending_signature_payment', () => {
    expect(statusToLaneId('pending_contract_payment')).toBe('pending_signature_payment');
  });

  it('under_contract → under_contract', () => {
    expect(statusToLaneId('under_contract')).toBe('under_contract');
  });

  it('post_event_close_out → post_event_close_out (own lane)', () => {
    expect(statusToLaneId('post_event_close_out')).toBe('post_event_close_out');
  });

  it('completed → completed (own lane)', () => {
    expect(statusToLaneId('completed')).toBe('completed');
  });

  it('did_not_book → did_not_book (own lane)', () => {
    expect(statusToLaneId('did_not_book')).toBe('did_not_book');
  });

  // Legacy statuses — kept in enum after migration 035, mapped to safe lanes
  it('halted → tracking_on_hold (legacy mapping, migrated by migration 035)', () => {
    expect(statusToLaneId('halted')).toBe('tracking_on_hold');
  });

  it('planning → under_contract (legacy mapping, migrated by migration 035)', () => {
    expect(statusToLaneId('planning')).toBe('under_contract');
  });

  it('planning_not_started → under_contract (legacy mapping, migrated by migration 035)', () => {
    expect(statusToLaneId('planning_not_started')).toBe('under_contract');
  });

  it('unresponsive → did_not_book (stalled / unreachable)', () => {
    expect(statusToLaneId('unresponsive')).toBe('did_not_book');
  });
});

describe('canonical status per lane (what gets written on drag-and-drop)', () => {
  it('Tracking/On Hold → tracking_on_hold', () => {
    expect(getLane('tracking_on_hold')!.canonicalStatus).toBe('tracking_on_hold');
  });

  it('New Lead → new_lead', () => {
    expect(getLane('new_lead')!.canonicalStatus).toBe('new_lead');
  });

  it('Proposal → proposal_in_progress', () => {
    expect(getLane('proposal')!.canonicalStatus).toBe('proposal_in_progress');
  });

  it('Pending Client Review → pending_client_review', () => {
    expect(getLane('pending_client_review')!.canonicalStatus).toBe('pending_client_review');
  });

  it('Negotiations → negotiations', () => {
    expect(getLane('negotiations')!.canonicalStatus).toBe('negotiations');
  });

  it('Pending Signature/Payment → pending_contract_payment', () => {
    expect(getLane('pending_signature_payment')!.canonicalStatus).toBe('pending_contract_payment');
  });

  it('Under Contract → under_contract', () => {
    expect(getLane('under_contract')!.canonicalStatus).toBe('under_contract');
  });

  it('Post Event Close Out → post_event_close_out', () => {
    expect(getLane('post_event_close_out')!.canonicalStatus).toBe('post_event_close_out');
  });

  it('Completed → completed', () => {
    expect(getLane('completed')!.canonicalStatus).toBe('completed');
  });

  it('Did Not Book → did_not_book', () => {
    expect(getLane('did_not_book')!.canonicalStatus).toBe('did_not_book');
  });
});

describe('lane colors', () => {
  it('tracking_on_hold is indigo', () => {
    expect(getLane('tracking_on_hold')!.color).toBe('indigo');
  });

  it('negotiations is rose', () => {
    expect(getLane('negotiations')!.color).toBe('rose');
  });

  it('pending_signature_payment is orange', () => {
    expect(getLane('pending_signature_payment')!.color).toBe('orange');
  });

  it('post_event_close_out is teal', () => {
    expect(getLane('post_event_close_out')!.color).toBe('teal');
  });
});

describe('statusToLane — returns full lane object', () => {
  it('tracking_on_hold returns correct lane', () => {
    const lane = statusToLane('tracking_on_hold');
    expect(lane!.label).toBe('Tracking / On Hold');
    expect(lane!.canonicalStatus).toBe('tracking_on_hold');
  });

  it('negotiations returns correct lane', () => {
    const lane = statusToLane('negotiations');
    expect(lane!.label).toBe('Negotiations');
    expect(lane!.color).toBe('rose');
  });

  it('completed and did_not_book are in separate lanes (not merged)', () => {
    expect(statusToLaneId('completed')).not.toBe(statusToLaneId('did_not_book'));
  });

  it('tracking_on_hold and did_not_book are separate lanes', () => {
    expect(statusToLaneId('tracking_on_hold')).not.toBe(statusToLaneId('did_not_book'));
  });
});

describe('no migration needed for new enum values', () => {
  it('tracking_on_hold is a valid status that maps correctly', () => {
    expect(statusToLaneId('tracking_on_hold')).toBe('tracking_on_hold');
  });

  it('negotiations is a valid status that maps correctly', () => {
    expect(statusToLaneId('negotiations')).toBe('negotiations');
  });
});

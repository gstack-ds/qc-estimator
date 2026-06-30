import { describe, it, expect } from 'vitest';
import {
  ALEX_STAGES,
  ACTIVE_CONFIG,
  stageStates,
  asideFor,
  activeStageIndex,
} from '../../src/lib/deal/statusConfig';
import { buildDealSections } from '../../src/lib/deal/sections';
import { fmtDate, fmtPercent, fmtBool, orDash } from '../../src/lib/deal/format';
import type { LeadStatus } from '../../src/lib/leads/constants';

describe('deal status config (Alex 8-stage, non-destructive map over 14 raw statuses)', () => {
  it('defaults ACTIVE_CONFIG to the 8 forward stages', () => {
    expect(ACTIVE_CONFIG).toBe(ALEX_STAGES);
    expect(ALEX_STAGES).toHaveLength(8);
    expect(ALEX_STAGES.map((s) => s.label)).toEqual([
      'New Lead',
      'Proposal in Progress',
      'Pending Client Review',
      'Negotiations',
      'Pending Signature/Payment',
      'Under Contract',
      'Post Event Closeout',
      'Completed',
    ]);
  });

  it('maps every one of the 14 raw lead statuses to a forward stage OR an aside (no orphans)', () => {
    const all: LeadStatus[] = [
      'tracking_on_hold', 'new_lead', 'proposal_in_progress', 'pending_client_review',
      'negotiations', 'pending_contract_payment', 'under_contract', 'post_event_close_out',
      'unresponsive', 'halted', 'planning', 'planning_not_started', 'did_not_book', 'completed',
    ];
    for (const s of all) {
      const onForward = activeStageIndex(ALEX_STAGES, s) !== -1;
      const onAside = asideFor(s) !== null;
      expect(onForward || onAside, `status ${s} must map somewhere`).toBe(true);
      expect(onForward && onAside, `status ${s} must not be both`).toBe(false);
    }
  });

  it('folds the legacy planning statuses into Under Contract', () => {
    expect(activeStageIndex(ALEX_STAGES, 'planning')).toBe(5);
    expect(activeStageIndex(ALEX_STAGES, 'planning_not_started')).toBe(5);
    expect(activeStageIndex(ALEX_STAGES, 'under_contract')).toBe(5);
  });

  it('classifies the 4 aside statuses (on_hold vs closed_lost)', () => {
    expect(asideFor('tracking_on_hold')?.kind).toBe('on_hold');
    expect(asideFor('halted')?.kind).toBe('on_hold');
    expect(asideFor('unresponsive')?.kind).toBe('closed_lost');
    expect(asideFor('did_not_book')?.kind).toBe('closed_lost');
    expect(asideFor('new_lead')).toBeNull();
  });

  it('stageStates marks prior stages complete, the match current, the rest upcoming', () => {
    const states = stageStates(ALEX_STAGES, 'negotiations'); // index 3
    expect(states[2].state).toBe('complete');
    expect(states[3].state).toBe('current');
    expect(states[4].state).toBe('upcoming');
  });

  it('an aside status leaves the forward stepper unhighlighted (all upcoming)', () => {
    const states = stageStates(ALEX_STAGES, 'did_not_book');
    expect(states.every((s) => s.state === 'upcoming')).toBe(true);
  });
});

describe('buildDealSections (all 3 deal shapes + per-event crumbs)', () => {
  it('lone lead: client + intake + dates + commission + program (no workspace sub-sections)', () => {
    const s = buildDealSections({ hasLead: true, hasProgram: false, events: [] });
    expect(s.map((x) => x.id)).toEqual(['client', 'intake', 'dates', 'commission', 'program']);
  });

  it('standalone program: client + commission + program workspace (no lead sections)', () => {
    const s = buildDealSections({ hasLead: false, hasProgram: true, events: [] });
    expect(s.map((x) => x.id)).toEqual([
      'client', 'commission', 'program', 'events', 'staffing', 'budget', 'documents', 'travel',
    ]);
    expect(s.map((x) => x.id)).not.toContain('intake');
  });

  it('pair: lead sections AND program workspace, with a crumb per event', () => {
    const s = buildDealSections({
      hasLead: true,
      hasProgram: true,
      events: [
        { id: 'e1', name: 'Welcome Reception' },
        { id: 'e2', name: 'Closing Dinner' },
      ],
    });
    const ids = s.map((x) => x.id);
    expect(ids).toContain('intake');
    expect(ids).toContain('event-e1');
    expect(ids).toContain('event-e2');
    // event crumbs sit between the Events section and Staffing
    expect(ids.indexOf('event-e1')).toBeGreaterThan(ids.indexOf('events'));
    expect(ids.indexOf('event-e1')).toBeLessThan(ids.indexOf('staffing'));
    const e1 = s.find((x) => x.id === 'event-e1');
    expect(e1?.label).toBe('Welcome Reception');
  });

  it('falls back to "Event" label for an unnamed event', () => {
    const s = buildDealSections({ hasLead: false, hasProgram: true, events: [{ id: 'e1', name: null }] });
    expect(s.find((x) => x.id === 'event-e1')?.label).toBe('Event');
  });
});

describe('deal formatters', () => {
  it('fmtDate formats from string parts without a timezone shift', () => {
    expect(fmtDate('2027-05-11')).toBe('May 11, 2027');
    expect(fmtDate(null)).toBe('—');
  });
  it('fmtPercent treats stored decimals as percentages', () => {
    expect(fmtPercent(0.05)).toBe('5%');
    expect(fmtPercent(0.065)).toBe('6.5%');
    expect(fmtPercent(null)).toBe('—');
  });
  it('fmtBool / orDash handle null', () => {
    expect(fmtBool(true)).toBe('Yes');
    expect(fmtBool(null)).toBe('—');
    expect(orDash('')).toBe('—');
    expect(orDash(0)).toBe('0');
  });
});

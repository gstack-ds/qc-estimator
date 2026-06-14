import { describe, it, expect, vi } from 'vitest';
import { handleGetPipeline } from '../../tools/pipeline';
import { createMockDb, ok } from '../helpers/mockDb';

const LEADS = [
  {
    id: 'lead-1',
    client_name: 'Acme Corp',
    end_company: null,
    program_name: 'Annual Dinner',
    start_date: '2026-09-15',
    end_date: null,
    guest_count: 100,
    city: 'Charlotte',
    state: 'NC',
    status: 'new_lead',
    assigned_to: 1,
    gdp_advisor: null,
    gdp_coordinator: null,
    lead_source_type: null,
    current_due_date: '2026-08-01',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'lead-2',
    client_name: 'Beta Inc',
    end_company: 'Beta Inc',
    program_name: 'Holiday Party',
    start_date: '2026-12-10',
    end_date: null,
    guest_count: 50,
    city: 'Rock Hill',
    state: 'SC',
    status: 'proposal_in_progress',
    assigned_to: null,
    gdp_advisor: null,
    gdp_coordinator: null,
    lead_source_type: null,
    current_due_date: null,
    created_at: '2026-01-05T00:00:00Z',
    updated_at: '2026-01-06T00:00:00Z',
  },
];

const TEAM_MEMBERS = [
  { id: 1, first_name: 'Alex', last_name: 'Johnson' },
];

describe('handleGetPipeline', () => {
  it('returns pipeline with lanes', async () => {
    const db = createMockDb({
      leads: ok(LEADS),
      team_members: ok(TEAM_MEMBERS),
      programs: ok([]),
    });
    const result = await handleGetPipeline(db as never, {});

    expect(result.total_leads).toBe(2);
    expect(result.status_group).toBe('open');
    expect(result.lanes).toBeInstanceOf(Array);
  });

  it('resolves team member names', async () => {
    const db = createMockDb({
      leads: ok([LEADS[0]]),
      team_members: ok(TEAM_MEMBERS),
      programs: ok([]),
    });
    const result = await handleGetPipeline(db as never, {});

    const lane = result.lanes.find((l) => l.status === 'new_lead');
    expect(lane).toBeDefined();
    expect(lane!.leads[0].assigned_to).toBe('Alex Johnson');
  });

  it('formats location from city + state', async () => {
    const db = createMockDb({
      leads: ok([LEADS[0]]),
      team_members: ok([]),
      programs: ok([]),
    });
    const result = await handleGetPipeline(db as never, {});

    const lane = result.lanes.find((l) => l.status === 'new_lead');
    expect(lane!.leads[0].location).toBe('Charlotte, NC');
  });

  it('groups leads into correct lanes', async () => {
    const db = createMockDb({
      leads: ok(LEADS),
      team_members: ok(TEAM_MEMBERS),
      programs: ok([]),
    });
    const result = await handleGetPipeline(db as never, {});

    const newLeadLane = result.lanes.find((l) => l.status === 'new_lead');
    const proposalLane = result.lanes.find((l) => l.status === 'proposal_in_progress');
    expect(newLeadLane?.count).toBe(1);
    expect(proposalLane?.count).toBe(1);
  });

  it('filters closed statuses when status_group=closed', async () => {
    const closedLeads = [
      { ...LEADS[0], status: 'completed' },
      { ...LEADS[1], status: 'did_not_book' },
    ];
    const db = createMockDb({
      leads: ok(closedLeads),
      team_members: ok([]),
      programs: ok([]),
    });
    const result = await handleGetPipeline(db as never, { status_group: 'closed' });

    expect(result.status_group).toBe('closed');
    expect(result.total_leads).toBe(2);
    // All lanes should be closed statuses
    for (const lane of result.lanes) {
      expect(['completed', 'did_not_book', 'unresponsive']).toContain(lane.status);
    }
  });

  it('attaches linked program when lead has been converted', async () => {
    const linkedPrograms = [
      { id: 'prog-1', name: 'Annual Dinner Program', lead_id: 'lead-1', status: 'active' },
    ];
    const db = createMockDb({
      leads: ok([LEADS[0]]),
      team_members: ok([]),
      programs: ok(linkedPrograms),
    });
    const result = await handleGetPipeline(db as never, {});

    const lane = result.lanes.find((l) => l.status === 'new_lead');
    const leadCard = lane?.leads[0];
    expect(leadCard?.linked_program).not.toBeNull();
    expect(leadCard?.linked_program?.name).toBe('Annual Dinner Program');
  });

  it('returns total_by_status counts', async () => {
    const db = createMockDb({
      leads: ok(LEADS),
      team_members: ok([]),
      programs: ok([]),
    });
    const result = await handleGetPipeline(db as never, {});

    expect(result.total_by_status['new_lead']).toBe(1);
    expect(result.total_by_status['proposal_in_progress']).toBe(1);
  });

  it('passes status filter to Supabase query', async () => {
    const db = createMockDb({
      leads: ok([]),
      team_members: ok([]),
      programs: ok([]),
    });
    await handleGetPipeline(db as never, { status_group: 'open' });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.calls;
    const leadsFromCall = fromCall.find(([table]: string[]) => table === 'leads');
    expect(leadsFromCall).toBeDefined();
  });
});

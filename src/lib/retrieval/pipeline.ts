// Shared read-only retrieval handler (leads pipeline).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GetPipelineArgs } from './types';

// Imported from a side-effect-free module (no next/headers)
import {
  STATUS_LABELS,
  type LeadStatus,
} from '../leads/constants';

// ─── Pipeline lane config (mirrors the Kanban UI) ─────────────────────────────

const OPEN_LANE_ORDER: LeadStatus[] = [
  'new_lead',
  'proposal_in_progress',
  'pending_client_review',
  'negotiations',
  'pending_contract_payment',
  'under_contract',
  'post_event_close_out',
  'tracking_on_hold',
];

const CLOSED_LANE_ORDER: LeadStatus[] = ['completed', 'did_not_book', 'unresponsive'];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleGetPipeline(
  db: SupabaseClient,
  args: GetPipelineArgs,
) {
  const group = args.status_group ?? 'open';

  // Use lane-order arrays directly — they contain only live statuses.
  // OPEN_STATUSES includes legacy values (halted, planning, planning_not_started) that were
  // migrated away in migration 035; querying for them returns no rows and pollutes the IN clause.
  let targetStatuses: string[];
  if (group === 'open') targetStatuses = OPEN_LANE_ORDER as string[];
  else if (group === 'closed') targetStatuses = CLOSED_LANE_ORDER as string[];
  else targetStatuses = [...OPEN_LANE_ORDER, ...CLOSED_LANE_ORDER] as string[];

  const { data: leads, error } = await db
    .from('leads')
    .select(
      'id, client_name, end_company, program_name, start_date, end_date, guest_count, city, state, status, assigned_to, gdp_advisor, gdp_coordinator, lead_source_type, current_due_date, created_at, updated_at'
    )
    .in('status', targetStatuses)
    .order('start_date', { ascending: true, nullsFirst: false });

  if (error) throw new Error(`get_pipeline: ${error.message}`);

  // Fetch team members to resolve assigned_to names — enrichment, degrade gracefully
  const { data: teamMembers, error: teamErr } = await db
    .from('team_members')
    .select('id, first_name, last_name')
    .eq('is_active', true);
  if (teamErr) console.error(`get_pipeline team_members: ${teamErr.message}`);

  const memberById = new Map(
    (teamMembers ?? []).map((m: { id: number; first_name: string; last_name: string }) => [
      m.id,
      `${m.first_name} ${m.last_name}`.trim(),
    ])
  );

  // Fetch linked programs (converted leads) for banner display — enrichment, degrade gracefully
  const { data: linkedPrograms, error: linkedErr } = await db
    .from('programs')
    .select('id, name, lead_id, status')
    .not('lead_id', 'is', null);
  if (linkedErr) console.error(`get_pipeline linked_programs: ${linkedErr.message}`);

  const programByLeadId = new Map(
    (linkedPrograms ?? []).map((p: { id: string; name: string; lead_id: string; status: string }) => [
      p.lead_id,
      { id: p.id, name: p.name, status: p.status },
    ])
  );

  // Build lane order
  const laneOrder = group === 'open'
    ? OPEN_LANE_ORDER
    : group === 'closed'
    ? CLOSED_LANE_ORDER
    : [...OPEN_LANE_ORDER, ...CLOSED_LANE_ORDER];

  const lanesByStatus = new Map<string, typeof leads>( );
  for (const lead of leads ?? []) {
    const status = lead.status as string;
    if (!lanesByStatus.has(status)) lanesByStatus.set(status, []);
    lanesByStatus.get(status)!.push(lead);
  }

  const lanes = laneOrder
    .filter((status) => targetStatuses.includes(status as LeadStatus))
    .map((status) => {
      const laneLeads = (lanesByStatus.get(status as string) ?? []).map((lead) => ({
        id: lead.id,
        client: lead.client_name,
        company: lead.end_company,
        program_name: lead.program_name,
        start_date: lead.start_date,
        end_date: lead.end_date,
        guest_count: lead.guest_count,
        location: lead.city && lead.state ? `${lead.city}, ${lead.state}` : (lead.city ?? lead.state ?? null),
        assigned_to: lead.assigned_to != null ? memberById.get(lead.assigned_to) ?? String(lead.assigned_to) : null,
        gdp_advisor: lead.gdp_advisor,
        lead_source_type: lead.lead_source_type,
        due_date: lead.current_due_date,
        linked_program: programByLeadId.get(lead.id) ?? null,
        updated_at: lead.updated_at,
      }));

      return {
        status,
        label: STATUS_LABELS[status as LeadStatus] ?? status,
        count: laneLeads.length,
        leads: laneLeads,
      };
    })
    .filter((lane) => lane.count > 0 || group !== 'all'); // always show open/closed lanes; only include non-empty in 'all'

  const totalLeads = (leads ?? []).length;
  const totalByStatus = Object.fromEntries(
    [...lanesByStatus.entries()].map(([status, arr]) => [status, arr.length])
  );

  return {
    status_group: group,
    total_leads: totalLeads,
    total_by_status: totalByStatus,
    lanes,
  };
}

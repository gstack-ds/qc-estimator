import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const listProgramsSchema = {
  status: z.enum(['active', 'completed', 'did_not_book']).optional()
    .describe('Filter by program lifecycle status'),
  client: z.string().optional()
    .describe('Partial match on client_name (case-insensitive)'),
  start_after: z.string().optional()
    .describe('ISO date — only programs whose event_date is >= this value'),
  start_before: z.string().optional()
    .describe('ISO date — only programs whose event_date is <= this value'),
  limit: z.number().int().min(1).max(100).default(50).optional()
    .describe('Max records to return (default 50, max 100)'),
};

export const getProgramSchema = {
  id: z.string().describe('Program UUID'),
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleListPrograms(
  db: SupabaseClient,
  args: z.infer<z.ZodObject<typeof listProgramsSchema>>
) {
  let query = db
    .from('programs')
    .select(
      'id, name, client_name, company_name, event_date, guest_count, status, program_type, lead_id, created_at, updated_at, latest_total'
    )
    .order('event_date', { ascending: true, nullsFirst: false })
    .limit(args.limit ?? 50);

  if (args.status) query = query.eq('status', args.status);
  if (args.client) query = query.ilike('client_name', `%${args.client}%`);
  if (args.start_after) query = query.gte('event_date', args.start_after);
  if (args.start_before) query = query.lte('event_date', args.start_before);

  const { data, error } = await query;
  if (error) throw new Error(`list_programs: ${error.message}`);

  return {
    count: (data ?? []).length,
    programs: (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      client: p.client_name,
      company: p.company_name,
      event_date: p.event_date,
      guest_count: p.guest_count,
      status: p.status,
      program_type: p.program_type,
      has_lead: !!p.lead_id,
      latest_total: p.latest_total,
      updated_at: p.updated_at,
    })),
  };
}

export async function handleGetProgram(
  db: SupabaseClient,
  args: z.infer<z.ZodObject<typeof getProgramSchema>>
) {
  const [programResult, eventsResult, staffingResult] = await Promise.all([
    db
      .from('programs')
      .select(
        `id, name, client_name, company_name, event_date, guest_count, service_style,
         alcohol_type, event_time, event_start_time, event_end_time, client_hotel,
         location_id, cc_processing_fee, client_commission, gdp_commission_enabled,
         gdp_commission_rate, service_charge_default, gratuity_default, admin_fee_default,
         third_party_commissions, status, archived_at, include_travel_in_production_fee,
         lead_id, program_type, created_at, updated_at,
         location:locations(id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate)`
      )
      .eq('id', args.id)
      .single(),
    db
      .from('events')
      .select('id, name, event_date, start_time, end_time, guest_count, event_type, sort_order, budget_amount, budget_basis')
      .eq('program_id', args.id)
      .order('event_date', { ascending: true, nullsFirst: true }),
    db
      .from('program_staffing')
      .select('id, role, status, assigned_to, notes')
      .eq('program_id', args.id)
      .order('sort_order'),
  ]);

  if (programResult.error) {
    if (programResult.error.code === 'PGRST116') return null;
    throw new Error(`get_program: ${programResult.error.message}`);
  }
  const prog = programResult.data;
  if (!prog) return null;

  // Fetch estimates grouped by event
  const { data: estimates } = await db
    .from('estimates')
    .select('id, name, type, event_id, included_in_proposal, include_in_budget, sort_order, venue_id')
    .eq('program_id', args.id)
    .order('sort_order');

  // Fetch linked lead basics if present
  let lead = null;
  if (prog.lead_id) {
    const { data: leadData } = await db
      .from('leads')
      .select('id, client_name, status, start_date, city, state')
      .eq('id', prog.lead_id)
      .single();
    lead = leadData;
  }

  const events = (eventsResult.data ?? []).map((ev) => ({
    id: ev.id,
    name: ev.name,
    event_date: ev.event_date,
    start_time: ev.start_time,
    end_time: ev.end_time,
    guest_count: ev.guest_count,
    event_type: ev.event_type,
    budget_amount: ev.budget_amount,
    budget_basis: ev.budget_basis,
    estimates: (estimates ?? [])
      .filter((e) => e.event_id === ev.id)
      .map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        included_in_proposal: e.included_in_proposal,
        include_in_budget: e.include_in_budget,
      })),
  }));

  const loc = prog.location as { id: string; name: string; food_tax_rate: number; alcohol_tax_rate: number; general_tax_rate: number } | null;

  return {
    id: prog.id,
    name: prog.name,
    client: prog.client_name,
    company: prog.company_name,
    event_date: prog.event_date,
    guest_count: prog.guest_count,
    service_style: prog.service_style,
    alcohol_type: prog.alcohol_type,
    event_time: prog.event_time,
    client_hotel: prog.client_hotel,
    status: prog.status,
    program_type: prog.program_type,
    location: loc
      ? {
          id: loc.id,
          name: loc.name,
          food_tax_rate: loc.food_tax_rate,
          alcohol_tax_rate: loc.alcohol_tax_rate,
          general_tax_rate: loc.general_tax_rate,
        }
      : null,
    fees: {
      cc_processing_fee: prog.cc_processing_fee,
      client_commission: prog.client_commission,
      gdp_commission_enabled: prog.gdp_commission_enabled,
      gdp_commission_rate: prog.gdp_commission_rate,
      service_charge_default: prog.service_charge_default,
      gratuity_default: prog.gratuity_default,
      admin_fee_default: prog.admin_fee_default,
      third_party_commissions: prog.third_party_commissions ?? [],
      include_travel_in_production_fee: prog.include_travel_in_production_fee,
    },
    events,
    staffing: (staffingResult.data ?? []).map((s) => ({
      id: s.id,
      role: s.role,
      status: s.status,
      assigned_to: s.assigned_to,
      notes: s.notes,
    })),
    lead,
    created_at: prog.created_at,
    updated_at: prog.updated_at,
  };
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { LeadStatus } from '@/lib/supabase/queries';
import { normalizeCity } from '@/lib/venues/normalize';
import { createClientFromLead, ensureLeadClientId, deleteClientIfOrphaned } from '@/lib/clients/sync';

export type LeadInput = Partial<{
  client_name: string | null;
  end_company: string | null;
  end_client: string | null;
  contact_name: string | null;
  client_contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  third_party_company: string | null;
  third_party_contact: string | null;
  third_party_comm_notes: string | null;
  program_name: string | null;
  program_type: string | null;
  program_description: string | null;
  start_date: string | null;
  end_date: string | null;
  rain_date: string | null;
  num_nights: number | null;
  guest_count: number | null;
  city: string | null;
  state: string | null;
  hotel: string | null;
  venue: string | null;
  region: string | null;
  lead_source: string | null;
  lead_source_type: string | null;
  source_advisor: string | null;
  source_coordinator: string | null;
  sales_coordinator: string | null;
  source_commission: number | null;
  third_party_commission: number | null;
  gdp_commission: number | null;
  extra_commission: number | null;
  commission_notes: string | null;
  billing_notes: string | null;
  returning_client: boolean | null;
  special_instructions: string | null;
  assigned_to: number | null;
  team_support: number | null;
  suggested_owner: string | null;
  gdp_advisor: string | null;
  gdp_coordinator: string | null;
  third_party: string | null;
  date_last_followup: string | null;
  current_due_date: string | null;
  original_email_link: string | null;
  status: LeadStatus;
}>;

export async function createLead(data: LeadInput): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient();
  const normalized = data.city ? { ...data, city: normalizeCity(data.city) } : data;
  // Phase 2A: every new lead gets its own client row + link (best-effort — a null
  // client_id never blocks the lead insert).
  const clientId = await createClientFromLead(supabase, normalized);
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({ ...normalized, client_id: clientId, status: normalized.status ?? 'new_lead' })
    .select('id')
    .single();
  if (error) return { error: error.message, id: null };
  revalidatePath('/leads');
  return { error: null, id: lead.id as string };
}

export async function updateLead(id: string, data: LeadInput): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const normalized = data.city ? { ...data, city: normalizeCity(data.city) } : data;
  const { error } = await supabase.from('leads').update(normalized).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
  return { error: null };
}

export async function deleteLead(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  // Capture client_id on the way out so we can GC the client if this was its last referrer.
  const { data: deleted, error } = await supabase.from('leads').delete().eq('id', id).select('client_id');
  if (error) return { error: error.message };
  // Best-effort GC — the lead is already gone; never let a clients-table hiccup surface as an error.
  try { await deleteClientIfOrphaned(supabase, deleted?.[0]?.client_id as string | null | undefined); } catch { /* ignore */ }
  revalidatePath('/leads');
  return { error: null };
}

export async function bulkArchiveLeads(onOrBeforeDate: string): Promise<{ error: string | null; count: number }> {
  const supabase = await createClient();
  // Include the full cutoff day by using < day+1
  const next = new Date(onOrBeforeDate);
  next.setDate(next.getDate() + 1);
  const upperBound = next.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('leads')
    .update({ status: 'did_not_book', archived_at: new Date().toISOString() })
    .not('start_date', 'is', null)
    .lt('start_date', upperBound)
    .neq('status', 'did_not_book')
    .select('id');
  if (error) return { error: error.message, count: 0 };
  revalidatePath('/leads');
  return { error: null, count: data.length };
}

export async function createProgramFromLead(leadId: string): Promise<{ error: string | null; programId: string | null }> {
  const supabase = await createClient();

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();
  if (leadErr || !lead) return { error: leadErr?.message ?? 'Lead not found', programId: null };

  const { data: { user } } = await supabase.auth.getUser();

  // Build location_id lookup by city/state if possible
  let locationId: string | null = null;
  if (lead.city || lead.state) {
    const hint = [lead.city, lead.state].filter(Boolean).join(' ');
    const { data: locations } = await supabase
      .from('locations')
      .select('id, name')
      .ilike('name', `%${hint.split(' ')[0]}%`)
      .limit(1);
    locationId = locations?.[0]?.id ?? null;
  }

  const programName = lead.program_name || lead.client_name || 'New Program';
  const clientCommission = typeof lead.source_commission === 'number' ? lead.source_commission : 0.05;
  const gdpEnabled = typeof lead.third_party_commission === 'number' && lead.third_party_commission > 0;

  // Phase 2A: the converted program SHARES the lead's client (one client, not two).
  // ensureLeadClientId reuses lead.client_id, or backfills one for a pre-2A lead.
  const sharedClientId = await ensureLeadClientId(supabase, lead);

  const { data: program, error: progErr } = await supabase
    .from('programs')
    .insert({
      name: programName,
      client_name: lead.client_name,
      company_name: lead.end_company,
      event_date: lead.start_date,
      guest_count: lead.guest_count ?? 0,
      client_hotel: lead.hotel,
      location_id: locationId,
      client_commission: clientCommission,
      gdp_commission_enabled: gdpEnabled,
      gdp_commission_rate: gdpEnabled ? (lead.third_party_commission ?? 0) : 0,
      lead_id: leadId,
      client_id: sharedClientId,
      created_by: user?.id,
    })
    .select('id')
    .single();

  if (progErr) return { error: progErr.message, programId: null };

  // Advance lead to Proposal in Progress (migration 020 renamed 'proposal' → 'proposal_in_progress')
  await supabase.from('leads').update({ status: 'proposal_in_progress' }).eq('id', leadId);

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/programs');
  return { error: null, programId: program.id as string };
}

export async function mergeLeads(
  survivingId: string,
  duplicateIds: string[],
  fieldValues: LeadInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  if (Object.keys(fieldValues).length > 0) {
    const { error } = await supabase.from('leads').update(fieldValues).eq('id', survivingId);
    if (error) return { error: error.message };
  }

  // Re-point linked programs to the surviving lead
  if (duplicateIds.length > 0) {
    const { error } = await supabase
      .from('programs')
      .update({ lead_id: survivingId })
      .in('lead_id', duplicateIds);
    if (error) return { error: error.message };

    const { error: delErr } = await supabase.from('leads').delete().in('id', duplicateIds);
    if (delErr) return { error: delErr.message };
  }

  revalidatePath('/leads');
  return { error: null };
}

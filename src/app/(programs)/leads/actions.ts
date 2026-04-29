'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { LeadStatus } from '@/lib/supabase/queries';

export type LeadInput = Partial<{
  client_name: string | null;
  end_company: string | null;
  contact_name: string | null;
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
  source_advisor: string | null;
  source_coordinator: string | null;
  source_commission: number | null;
  third_party_commission: number | null;
  commission_notes: string | null;
  billing_notes: string | null;
  returning_client: boolean | null;
  special_instructions: string | null;
  assigned_to: string | null;
  suggested_owner: string | null;
  original_email_link: string | null;
  status: LeadStatus;
}>;

export async function createLead(data: LeadInput): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({ ...data, status: data.status ?? 'new_lead' })
    .select('id')
    .single();
  if (error) return { error: error.message, id: null };
  revalidatePath('/leads');
  return { error: null, id: lead.id as string };
}

export async function updateLead(id: string, data: LeadInput): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('leads').update(data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
  return { error: null };
}

export async function deleteLead(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/leads');
  return { error: null };
}

export async function archiveLead(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('leads')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
  return { error: null };
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
      created_by: user?.id,
    })
    .select('id')
    .single();

  if (progErr) return { error: progErr.message, programId: null };

  // Move lead to proposal
  await supabase.from('leads').update({ status: 'proposal' }).eq('id', leadId);

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/programs');
  return { error: null, programId: program.id as string };
}

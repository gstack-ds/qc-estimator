'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Programs ────────────────────────────────────────────

export async function createProgram(data: {
  name: string;
  client_name?: string | null;
  event_date?: string | null;
  guest_count?: number;
  service_style?: string | null;
  alcohol_type?: string | null;
  event_time?: string | null;
  company_name?: string | null;
  client_hotel?: string | null;
  location_id?: string | null;
  cc_processing_fee?: number;
  client_commission?: number;
  gdp_commission_enabled?: boolean;
  service_charge_default?: string;
  gratuity_default?: string;
  admin_fee_default?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: program, error } = await supabase
    .from('programs')
    .insert({ ...data, created_by: user?.id })
    .select('id')
    .single();

  if (error) return { error: error.message, id: null };
  revalidatePath('/programs');
  return { error: null, id: program.id as string };
}

export async function updateProgram(id: string, data: Partial<{
  name: string;
  client_name: string | null;
  event_date: string | null;
  guest_count: number;
  service_style: string | null;
  alcohol_type: string | null;
  event_time: string | null;
  company_name: string | null;
  client_hotel: string | null;
  location_id: string | null;
  cc_processing_fee: number;
  client_commission: number;
  gdp_commission_enabled: boolean;
  gdp_commission_rate: number;
  service_charge_default: string;
  gratuity_default: string;
  admin_fee_default: string;
}>) {
  const supabase = await createClient();
  const { error } = await supabase.from('programs').update(data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${id}`);
  return { error: null };
}

// ─── Estimates ────────────────────────────────────────────

export async function createEstimate(programId: string) {
  const supabase = await createClient();

  // Count existing estimates to set sort_order
  const { count } = await supabase
    .from('estimates')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId);

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      program_id: programId,
      type: 'venue',
      name: 'New Estimate',
      fb_minimum: 0,
      is_venue_taxable: true,
      sort_order: (count ?? 0),
    })
    .select('id')
    .single();

  if (error) return { error: error.message, id: null };
  revalidatePath(`/programs/${programId}`);
  return { error: null, id: estimate.id as string };
}

export async function deleteProgram(programId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('programs').delete().eq('id', programId);
  if (error) return { error: error.message };
  revalidatePath('/programs');
  return { error: null };
}


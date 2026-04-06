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
  event_start_time?: string | null;
  event_end_time?: string | null;
  company_name?: string | null;
  client_hotel?: string | null;
  location_id?: string | null;
  cc_processing_fee?: number;
  client_commission?: number;
  gdp_commission_enabled?: boolean;
  service_charge_default?: number;
  gratuity_default?: number;
  admin_fee_default?: number;
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
  event_start_time: string | null;
  event_end_time: string | null;
  company_name: string | null;
  client_hotel: string | null;
  location_id: string | null;
  cc_processing_fee: number;
  client_commission: number;
  gdp_commission_enabled: boolean;
  gdp_commission_rate: number;
  service_charge_default: number;
  gratuity_default: number;
  admin_fee_default: number;
}>) {
  const supabase = await createClient();
  const { error } = await supabase.from('programs').update(data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${id}`);
  return { error: null };
}

// ─── Estimates ────────────────────────────────────────────

export async function createEstimate(programId: string, type: 'venue' | 'av' | 'decor' = 'venue') {
  const supabase = await createClient();

  // Count existing estimates to set sort_order
  const { count } = await supabase
    .from('estimates')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId);

  const defaultName = type === 'av' ? 'New AV Estimate' : type === 'decor' ? 'New Decor Estimate' : 'New Estimate';

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      program_id: programId,
      type,
      name: defaultName,
      fb_minimum: 0,
      is_venue_taxable: type === 'venue',
      ...(type === 'av' || type === 'decor' ? {
        service_charge_override: 0,
        gratuity_override: 0,
        admin_fee_override: 0,
      } : {}),
      sort_order: (count ?? 0),
    })
    .select('id')
    .single();

  if (error) return { error: error.message, id: null };

  // For venue estimates, seed default line items
  if (type === 'venue') {
    // Look up the categories we need
    const { data: markups } = await supabase
      .from('category_markups')
      .select('id, name')
      .in('name', ['Catering & F&B', 'Staffing & Labor']);

    const fbMarkup = markups?.find((m) => m.name === 'Catering & F&B');
    const staffingMarkup = markups?.find((m) => m.name === 'Staffing & Labor');

    // Fetch guest count for default quantities
    const { data: program } = await supabase
      .from('programs')
      .select('guest_count')
      .eq('id', programId)
      .single();

    const guestCount = program?.guest_count ?? 1;

    const defaultItems = [
      { section: 'F&B', name: 'Per Person Food',  qty: guestCount, unit_price: 0, category_id: fbMarkup?.id ?? null, tax_type: 'food',    sort_order: 0 },
      { section: 'F&B', name: 'Bar Package',       qty: guestCount, unit_price: 0, category_id: fbMarkup?.id ?? null, tax_type: 'alcohol', sort_order: 1 },
      { section: 'F&B', name: 'NA Beverages',      qty: guestCount, unit_price: 0, category_id: fbMarkup?.id ?? null, tax_type: 'food',    sort_order: 2 },
      { section: 'Non-Taxable Staffing', name: 'QC Event Staff', qty: 1, unit_price: 0, category_id: staffingMarkup?.id ?? null, tax_type: 'none', sort_order: 0 },
    ];

    await supabase.from('estimate_line_items').insert(
      defaultItems.map((item) => ({ ...item, estimate_id: estimate.id }))
    );
  }

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


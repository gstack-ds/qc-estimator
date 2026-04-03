'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Estimate details ─────────────────────────────────────

export async function updateEstimate(id: string, programId: string, data: Partial<{
  name: string;
  room_space: string | null;
  fb_minimum: number;
  is_venue_taxable: boolean;
  service_charge_override: string | null;
  gratuity_override: string | null;
  admin_fee_override: string | null;
  venue_contact: string | null;
  menu_notes: string | null;
  include_in_budget: boolean;
}>) {
  const supabase = await createClient();
  const { error } = await supabase.from('estimates').update(data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function deleteEstimate(id: string, programId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('estimates').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function duplicateEstimate(sourceId: string, programId: string) {
  const supabase = await createClient();

  // Fetch source estimate
  const { data: source, error: sourceErr } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', sourceId)
    .single();
  if (sourceErr) return { error: sourceErr.message, id: null };

  // Fetch source line items
  const { data: lineItems, error: liErr } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', sourceId)
    .order('sort_order');
  if (liErr) return { error: liErr.message, id: null };

  // Count existing to set sort_order
  const { count } = await supabase
    .from('estimates')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId);

  // Create new estimate
  const { data: newEstimate, error: newErr } = await supabase
    .from('estimates')
    .insert({
      program_id: programId,
      type: source.type,
      name: `${source.name} (copy)`,
      room_space: source.room_space,
      fb_minimum: source.fb_minimum,
      is_venue_taxable: source.is_venue_taxable,
      service_charge_override: source.service_charge_override,
      gratuity_override: source.gratuity_override,
      admin_fee_override: source.admin_fee_override,
      include_in_budget: source.include_in_budget,
      sort_order: count ?? 0,
    })
    .select('id')
    .single();
  if (newErr) return { error: newErr.message, id: null };

  // Copy line items
  if (lineItems && lineItems.length > 0) {
    const { error: copyErr } = await supabase.from('estimate_line_items').insert(
      lineItems.map(({ id: _id, estimate_id: _eid, created_at: _ca, updated_at: _ua, ...rest }) => ({
        ...rest,
        estimate_id: newEstimate.id,
      }))
    );
    if (copyErr) return { error: copyErr.message, id: null };
  }

  revalidatePath(`/programs/${programId}`);
  return { error: null, id: newEstimate.id as string };
}

export async function reorderEstimates(programId: string, updates: { id: string; sort_order: number }[]) {
  const supabase = await createClient();
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from('estimates').update({ sort_order }).eq('id', id)
    )
  );
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

// ─── Line Items ──────────────────────────────────────────

export async function upsertLineItem(data: {
  id?: string;
  estimate_id: string;
  section: string;
  name: string;
  qty: number;
  unit_price: number;
  category_id: string | null;
  tax_type: string;
  custom_client_unit_price?: number | null;
  markup_override?: number | null;
  sort_order: number;
}) {
  const supabase = await createClient();

  if (data.id) {
    const { error } = await supabase
      .from('estimate_line_items')
      .update({
        section: data.section,
        name: data.name,
        qty: data.qty,
        unit_price: data.unit_price,
        category_id: data.category_id,
        tax_type: data.tax_type,
        custom_client_unit_price: data.custom_client_unit_price ?? null,
        markup_override: data.markup_override ?? null,
        sort_order: data.sort_order,
      })
      .eq('id', data.id);
    if (error) return { error: error.message, id: data.id };
    return { error: null, id: data.id };
  } else {
    const { data: newItem, error } = await supabase
      .from('estimate_line_items')
      .insert({
        estimate_id: data.estimate_id,
        section: data.section,
        name: data.name,
        qty: data.qty,
        unit_price: data.unit_price,
        category_id: data.category_id,
        tax_type: data.tax_type,
        custom_client_unit_price: data.custom_client_unit_price ?? null,
        markup_override: data.markup_override ?? null,
        sort_order: data.sort_order,
      })
      .select('id')
      .single();
    if (error) return { error: error.message, id: null };
    return { error: null, id: newItem.id as string };
  }
}

export async function deleteLineItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('estimate_line_items').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

// ─── Estimate Trips ───────────────────────────────────────

export async function upsertTrip(data: {
  estimate_id: string;
  trip_number: number;
  label: string;
  travel_type: string;
  drive_route_id: string | null;
  train_route_id: string | null;
  flight_type_id: string | null;
  last_minute_buffer: boolean;
  staff_count: number;
  nights: number;
  hotel_rate_id: string | null;
  hotel_budget: string;
  per_diem_rate_id: string | null;
  vehicle_rate_id: string | null;
  vehicle_type: string;
  vehicle_service: string;
  vehicle_hours: number;
  custom_vehicle_cost: number;
}) {
  const supabase = await createClient();
  const payload = {
    estimate_id: data.estimate_id,
    trip_number: data.trip_number,
    label: data.label,
    travel_type: data.travel_type,
    drive_route_id: data.drive_route_id,
    train_route_id: data.train_route_id,
    flight_type_id: data.flight_type_id,
    last_minute_buffer: data.last_minute_buffer,
    staff_count: data.staff_count,
    nights: data.nights,
    hotel_rate_id: data.hotel_rate_id,
    hotel_budget: data.hotel_budget,
    per_diem_rate_id: data.per_diem_rate_id,
    vehicle_rate_id: data.vehicle_rate_id,
    vehicle_type: data.vehicle_type,
    vehicle_service: data.vehicle_service,
    vehicle_hours: data.vehicle_hours,
    custom_vehicle_cost: data.custom_vehicle_cost,
  };
  const { error } = await supabase
    .from('estimate_trips')
    .upsert(payload, { onConflict: 'estimate_id,trip_number' });
  if (error) return { error: error.message };
  return { error: null };
}

export async function cacheEstimateTotal(estimateId: string, programId: string, total: number) {
  const supabase = await createClient();
  await supabase.from('estimates').update({ cached_total: total }).eq('id', estimateId);
  await supabase.from('programs').update({ latest_total: total }).eq('id', programId);
  return { error: null };
}

export async function getExportDataForProgram(programId: string) {
  const supabase = await createClient();
  const { data: estimates, error: estErr } = await supabase
    .from('estimates')
    .select('id, name, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override')
    .eq('program_id', programId)
    .order('sort_order');
  if (estErr) return { error: estErr.message, data: null };

  const estimateIds = (estimates ?? []).map((e) => e.id as string);
  if (estimateIds.length === 0) return { error: null, data: [] };

  const { data: lineItems, error: liErr } = await supabase
    .from('estimate_line_items')
    .select('id, estimate_id, section, name, qty, unit_price, category_id, tax_type, custom_client_unit_price, markup_override, sort_order')
    .in('estimate_id', estimateIds)
    .order('sort_order');
  if (liErr) return { error: liErr.message, data: null };

  const byEstimate = (estimates ?? []).map((est) => ({
    estimate: est,
    lineItems: (lineItems ?? []).filter((li) => li.estimate_id === est.id),
  }));

  return { error: null, data: byEstimate };
}

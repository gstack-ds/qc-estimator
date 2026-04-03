'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Locations ───────────────────────────────────────────

export async function upsertLocation(data: {
  id?: string;
  name: string;
  food_tax_rate: number;
  alcohol_tax_rate: number;
  general_tax_rate: number;
  effective_date?: string | null;
}) {
  const supabase = await createClient();

  if (data.id) {
    const { error } = await supabase
      .from('locations')
      .update({
        name: data.name,
        food_tax_rate: data.food_tax_rate,
        alcohol_tax_rate: data.alcohol_tax_rate,
        general_tax_rate: data.general_tax_rate,
        effective_date: data.effective_date ?? null,
      })
      .eq('id', data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('locations').insert({
      name: data.name,
      food_tax_rate: data.food_tax_rate,
      alcohol_tax_rate: data.alcohol_tax_rate,
      general_tax_rate: data.general_tax_rate,
      effective_date: data.effective_date ?? null,
    });
    if (error) return { error: error.message };
  }

  revalidatePath('/admin');
  return { error: null };
}

export async function deleteLocation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { error: null };
}

// ─── Category Markups ─────────────────────────────────────

export async function upsertMarkup(data: {
  id?: string;
  name: string;
  markup_pct: number;
  notes?: string | null;
  sort_order: number;
}) {
  const supabase = await createClient();

  if (data.id) {
    const { error } = await supabase
      .from('category_markups')
      .update({
        name: data.name,
        markup_pct: data.markup_pct,
        notes: data.notes ?? null,
        sort_order: data.sort_order,
      })
      .eq('id', data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('category_markups').insert({
      name: data.name,
      markup_pct: data.markup_pct,
      notes: data.notes ?? null,
      sort_order: data.sort_order,
    });
    if (error) return { error: error.message };
  }

  revalidatePath('/admin');
  return { error: null };
}

export async function deleteMarkup(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('category_markups').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { error: null };
}

// ─── Team Hours Tiers ─────────────────────────────────────

export async function upsertTier(data: {
  id?: string;
  revenue_threshold: number;
  base_hours: number;
  tier_name?: string | null;
}) {
  const supabase = await createClient();

  if (data.id) {
    const { error } = await supabase
      .from('team_hours_tiers')
      .update({
        revenue_threshold: data.revenue_threshold,
        base_hours: data.base_hours,
        tier_name: data.tier_name ?? null,
      })
      .eq('id', data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('team_hours_tiers').insert({
      revenue_threshold: data.revenue_threshold,
      base_hours: data.base_hours,
      tier_name: data.tier_name ?? null,
    });
    if (error) return { error: error.message };
  }

  revalidatePath('/admin');
  return { error: null };
}

export async function deleteTier(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('team_hours_tiers').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { error: null };
}

// ─── Drive Routes ─────────────────────────────────────────

export async function upsertDriveRoute(data: { id?: string; route_name: string; cost: number }) {
  const supabase = await createClient();
  if (data.id) {
    const { error } = await supabase.from('drive_routes').update({ route_name: data.route_name, cost: data.cost }).eq('id', data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('drive_routes').insert({ route_name: data.route_name, cost: data.cost });
    if (error) return { error: error.message };
  }
  revalidatePath('/admin');
  return { error: null };
}

export async function deleteDriveRoute(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('drive_routes').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { error: null };
}

// ─── Train Routes ─────────────────────────────────────────

export async function upsertTrainRoute(data: { id?: string; route_name: string; low_cost: number; high_cost: number }) {
  const supabase = await createClient();
  if (data.id) {
    const { error } = await supabase.from('train_routes').update({ route_name: data.route_name, low_cost: data.low_cost, high_cost: data.high_cost }).eq('id', data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('train_routes').insert({ route_name: data.route_name, low_cost: data.low_cost, high_cost: data.high_cost });
    if (error) return { error: error.message };
  }
  revalidatePath('/admin');
  return { error: null };
}

export async function deleteTrainRoute(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('train_routes').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { error: null };
}

// ─── Flight Types ─────────────────────────────────────────

export async function upsertFlightType(data: { id?: string; type_name: string; low_cost: number; high_cost: number }) {
  const supabase = await createClient();
  if (data.id) {
    const { error } = await supabase.from('flight_types').update({ type_name: data.type_name, low_cost: data.low_cost, high_cost: data.high_cost }).eq('id', data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('flight_types').insert({ type_name: data.type_name, low_cost: data.low_cost, high_cost: data.high_cost });
    if (error) return { error: error.message };
  }
  revalidatePath('/admin');
  return { error: null };
}

export async function deleteFlightType(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('flight_types').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { error: null };
}

// ─── Hotel Rates ──────────────────────────────────────────

export async function upsertHotelRate(data: { id?: string; market: string; low_rate: number; high_rate: number }) {
  const supabase = await createClient();
  if (data.id) {
    const { error } = await supabase.from('hotel_rates').update({ market: data.market, low_rate: data.low_rate, high_rate: data.high_rate }).eq('id', data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('hotel_rates').insert({ market: data.market, low_rate: data.low_rate, high_rate: data.high_rate });
    if (error) return { error: error.message };
  }
  revalidatePath('/admin');
  return { error: null };
}

export async function deleteHotelRate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('hotel_rates').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { error: null };
}

// ─── Per Diem Rates ───────────────────────────────────────

export async function upsertPerDiemRate(data: { id?: string; market_type: string; full_day: number; half_day: number }) {
  const supabase = await createClient();
  if (data.id) {
    const { error } = await supabase.from('per_diem_rates').update({ market_type: data.market_type, full_day: data.full_day, half_day: data.half_day }).eq('id', data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('per_diem_rates').insert({ market_type: data.market_type, full_day: data.full_day, half_day: data.half_day });
    if (error) return { error: error.message };
  }
  revalidatePath('/admin');
  return { error: null };
}

export async function deletePerDiemRate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('per_diem_rates').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { error: null };
}

// ─── Vehicle Rates ────────────────────────────────────────

export async function upsertVehicleRate(data: {
  id?: string; market: string;
  sedan_hourly: number; sedan_airport: number;
  suv_hourly: number; suv_airport: number;
  sprinter_hourly: number; sprinter_airport: number;
}) {
  const supabase = await createClient();
  const payload = {
    market: data.market,
    sedan_hourly: data.sedan_hourly,
    sedan_airport: data.sedan_airport,
    suv_hourly: data.suv_hourly,
    suv_airport: data.suv_airport,
    sprinter_hourly: data.sprinter_hourly,
    sprinter_airport: data.sprinter_airport,
  };
  if (data.id) {
    const { error } = await supabase.from('vehicle_rates').update(payload).eq('id', data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('vehicle_rates').insert(payload);
    if (error) return { error: error.message };
  }
  revalidatePath('/admin');
  return { error: null };
}

export async function deleteVehicleRate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('vehicle_rates').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { error: null };
}

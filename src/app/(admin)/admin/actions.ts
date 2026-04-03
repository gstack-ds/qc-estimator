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

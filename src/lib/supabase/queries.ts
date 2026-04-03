import { createClient } from './server';

// ─── Locations ───────────────────────────────────────────

export interface DbLocation {
  id: string;
  name: string;
  food_tax_rate: number;
  alcohol_tax_rate: number;
  general_tax_rate: number;
  effective_date: string | null;
  updated_at: string;
}

export async function getLocations(): Promise<DbLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate, effective_date, updated_at')
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Category Markups ─────────────────────────────────────

export interface DbMarkup {
  id: string;
  name: string;
  markup_pct: number;
  notes: string | null;
  sort_order: number;
  updated_at: string;
}

export async function getMarkups(): Promise<DbMarkup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('category_markups')
    .select('id, name, markup_pct, notes, sort_order, updated_at')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Team Hours Tiers ─────────────────────────────────────

export interface DbTier {
  id: string;
  revenue_threshold: number;
  base_hours: number;
  tier_name: string | null;
  created_at: string;
}

export async function getTiers(): Promise<DbTier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('team_hours_tiers')
    .select('id, revenue_threshold, base_hours, tier_name, created_at')
    .order('revenue_threshold');
  if (error) throw new Error(error.message);
  return data ?? [];
}

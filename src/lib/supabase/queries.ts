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

export async function getLocation(id: string): Promise<DbLocation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate, effective_date, updated_at')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
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

// ─── Programs ─────────────────────────────────────────────

export interface DbProgram {
  id: string;
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
  third_party_commissions: { name: string; rate: number }[];
  created_at: string;
  updated_at: string;
}

export interface DbProgramWithLocation extends DbProgram {
  location: DbLocation | null;
}

export interface DbProgramSummary {
  id: string;
  name: string;
  client_name: string | null;
  event_date: string | null;
  created_at: string;
  updated_at: string;
  estimate_count: number;
}

export async function getPrograms(): Promise<DbProgramSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, client_name, event_date, created_at, updated_at, estimates(count)')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    client_name: p.client_name,
    event_date: p.event_date,
    created_at: p.created_at,
    updated_at: p.updated_at,
    estimate_count: (p.estimates as unknown as [{ count: number }])[0]?.count ?? 0,
  }));
}

export async function getProgram(id: string): Promise<DbProgramWithLocation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('programs')
    .select(`
      id, name, client_name, event_date, guest_count, service_style,
      alcohol_type, event_time, company_name, client_hotel,
      location_id, cc_processing_fee, client_commission,
      gdp_commission_enabled, gdp_commission_rate,
      service_charge_default, gratuity_default, admin_fee_default,
      third_party_commissions, created_at, updated_at,
      location:locations(id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate, effective_date, updated_at)
    `)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as DbProgramWithLocation;
}

// ─── Estimates ────────────────────────────────────────────

export interface DbEstimate {
  id: string;
  program_id: string;
  type: string;
  name: string;
  room_space: string | null;
  fb_minimum: number;
  is_venue_taxable: boolean;
  service_charge_override: string | null;
  gratuity_override: string | null;
  admin_fee_override: string | null;
  include_in_budget: boolean;
  sort_order: number;
  venue_contact: string | null;
  menu_notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function getEstimatesForProgram(programId: string): Promise<DbEstimate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('id, program_id, type, name, room_space, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override, include_in_budget, sort_order, venue_contact, menu_notes, created_at, updated_at')
    .eq('program_id', programId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEstimate(id: string): Promise<DbEstimate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('id, program_id, type, name, room_space, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override, include_in_budget, sort_order, venue_contact, menu_notes, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

// ─── Line Items ───────────────────────────────────────────

export interface DbLineItem {
  id: string;
  estimate_id: string;
  section: string;
  name: string;
  qty: number;
  unit_price: number;
  category_id: string | null;
  tax_type: string;
  custom_client_unit_price: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getLineItemsForEstimate(estimateId: string): Promise<DbLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_line_items')
    .select('id, estimate_id, section, name, qty, unit_price, category_id, tax_type, custom_client_unit_price, notes, sort_order, created_at, updated_at')
    .eq('estimate_id', estimateId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLineItemsForEstimates(estimateIds: string[]): Promise<DbLineItem[]> {
  if (estimateIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_line_items')
    .select('id, estimate_id, section, name, qty, unit_price, category_id, tax_type, custom_client_unit_price, notes, sort_order, created_at, updated_at')
    .in('estimate_id', estimateIds)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

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

export async function getMarkets(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('markets').select('name').order('name');
  if (error) return []; // graceful before migration runs
  return (data ?? []).map((r: { name: string }) => r.name);
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
  third_party_commissions: { name: string; rate: number }[];
  status: string;
  archived_at: string | null;
  include_travel_in_production_fee: boolean;
  lead_id: string | null;
  program_type: string | null;
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
  status: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  estimate_count: number;
  latest_total: number | null;
  lead_id: string | null;
  program_type: string | null;
  staffing_needs_count: number;
  unread_response_count: number;
}

export async function getPrograms(): Promise<DbProgramSummary[]> {
  const supabase = await createClient();
  const [programsResult, staffingResult, unreadByProgram] = await Promise.all([
    supabase
      .from('programs')
      .select('id, name, client_name, event_date, status, archived_at, created_at, updated_at, latest_total, lead_id, program_type, estimates(count)')
      .order('updated_at', { ascending: false }),
    supabase
      .from('program_staffing')
      .select('program_id')
      .eq('status', 'needs_staffing'),
    getUnreadResponseCountByProgram(),
  ]);
  if (programsResult.error) throw new Error(programsResult.error.message);
  const openCounts: Record<string, number> = {};
  for (const row of staffingResult.data ?? []) {
    openCounts[row.program_id] = (openCounts[row.program_id] ?? 0) + 1;
  }
  return (programsResult.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    client_name: p.client_name,
    event_date: p.event_date,
    status: (p as unknown as { status: string }).status ?? 'active',
    archived_at: (p as unknown as { archived_at: string | null }).archived_at ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at,
    latest_total: (p as unknown as { latest_total: number | null }).latest_total,
    lead_id: (p as unknown as { lead_id: string | null }).lead_id ?? null,
    program_type: (p as unknown as { program_type: string | null }).program_type ?? null,
    estimate_count: (p.estimates as unknown as [{ count: number }])[0]?.count ?? 0,
    staffing_needs_count: openCounts[p.id] ?? 0,
    unread_response_count: unreadByProgram[p.id] ?? 0,
  }));
}

export async function getProgram(id: string): Promise<DbProgramWithLocation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('programs')
    .select(`
      id, name, client_name, event_date, guest_count, service_style,
      alcohol_type, event_time, event_start_time, event_end_time, company_name, client_hotel,
      location_id, cc_processing_fee, client_commission,
      gdp_commission_enabled, gdp_commission_rate,
      service_charge_default, gratuity_default, admin_fee_default,
      third_party_commissions, status, archived_at, include_travel_in_production_fee, lead_id, program_type, created_at, updated_at,
      location:locations(id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate, effective_date, updated_at)
    `)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as DbProgramWithLocation;
}

// ─── Program documents ────────────────────────────────────
// Types live in src/lib/programs/documentTypes.ts (server-free) so client
// components can import them without pulling in next/headers via this file.

export type { DocumentCategory, DbProgramDocument } from '@/lib/programs/documentTypes';
export { DOCUMENT_CATEGORIES } from '@/lib/programs/documentTypes';
import type { DbProgramDocument } from '@/lib/programs/documentTypes';

export async function getProgramDocuments(programId: string): Promise<DbProgramDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('program_documents')
    .select('id, program_id, file_name, storage_path, file_size, mime_type, category, notes, uploaded_by, created_at, updated_at')
    .eq('program_id', programId)
    .order('category')
    .order('created_at', { ascending: false });
  if (error) return [];
  // Generate signed URLs for all documents
  const withUrls = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from('estimate-attachments')
        .createSignedUrl(row.storage_path, 3600);
      return { ...row, url: signed?.signedUrl ?? '' } as DbProgramDocument;
    })
  );
  return withUrls;
}

// ─── Program briefs ───────────────────────────────────────

import type { ProgramBrief, BriefContent } from '@/lib/briefs/types';
export type { ProgramBrief } from '@/lib/briefs/types';

export async function getProgramBrief(programId: string): Promise<ProgramBrief | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('program_briefs')
    .select('id, program_id, content, section_owners, generated_at, last_edited_at')
    .eq('program_id', programId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ProgramBrief;
}

export async function upsertProgramBrief(
  programId: string,
  content: BriefContent,
  sectionOwners: Record<string, number | null> = {},
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('program_briefs')
    .upsert({
      program_id: programId,
      content,
      section_owners: sectionOwners,
      generated_at: new Date().toISOString(),
      last_edited_at: new Date().toISOString(),
    }, { onConflict: 'program_id' });
  return { error: error?.message ?? null };
}

export async function updateBriefSection(
  programId: string,
  sectionKey: string,
  content: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  // Fetch current content, patch the one section, write back
  const { data: current } = await supabase
    .from('program_briefs')
    .select('content')
    .eq('program_id', programId)
    .maybeSingle();
  const existing = (current?.content ?? {}) as Record<string, unknown>;
  const section = (existing[sectionKey] ?? {}) as Record<string, unknown>;
  const updated = {
    ...existing,
    [sectionKey]: { ...section, content, isAiDraft: false, lastEditedAt: new Date().toISOString() },
  };
  const { error } = await supabase
    .from('program_briefs')
    .update({ content: updated, last_edited_at: new Date().toISOString() })
    .eq('program_id', programId);
  return { error: error?.message ?? null };
}

// ─── Program travel items ─────────────────────────────────

export interface DbTravelItem {
  id: string;
  program_id: string;
  description: string;
  qty: number;
  unit_price: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getTravelItems(programId: string): Promise<DbTravelItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('program_travel_items')
    .select('id, program_id, description, qty, unit_price, sort_order, created_at, updated_at')
    .eq('program_id', programId)
    .order('sort_order');
  if (error) return [];
  return data as DbTravelItem[];
}

// ─── Events ───────────────────────────────────────────────

export interface DbEvent {
  id: string;
  program_id: string;
  name: string;
  event_date: string | null;
  start_time: string | null;
  budget_amount: number | null;
  budget_basis: 'overall' | 'per_person' | null;
  end_time: string | null;
  guest_count: number;
  event_type: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getEvent(id: string): Promise<DbEvent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('id, program_id, name, event_date, start_time, end_time, guest_count, event_type, description, sort_order, budget_amount, budget_basis, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as DbEvent;
}

export async function getEventsForProgram(programId: string): Promise<DbEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('id, program_id, name, event_date, start_time, end_time, guest_count, event_type, description, sort_order, budget_amount, budget_basis, created_at, updated_at')
    .eq('program_id', programId)
    .order('event_date', { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Estimates ────────────────────────────────────────────

export interface DbEstimate {
  id: string;
  program_id: string;
  event_id: string | null;
  type: string;
  name: string;
  room_space: string | null;
  fb_minimum: number;
  is_venue_taxable: boolean;
  service_charge_override: number | null;
  gratuity_override: number | null;
  admin_fee_override: number | null;
  include_in_budget: boolean;
  sort_order: number;
  venue_contact: string | null;
  menu_notes: string | null;
  transport_commission: number | null;
  venue_id: string | null;
  venue_space_id: string | null;
  discount_type: 'percent' | 'flat' | null;
  discount_value: number;
  eeg_enabled: boolean;
  eeg_rate: number;
  tax_exempt: boolean;
  food_tax_override: number | null;
  alcohol_tax_override: number | null;
  general_tax_override: number | null;
  slide_copy_data: Record<string, unknown> | null;
  tour_details: Record<string, unknown> | null;
  included_in_proposal: boolean;
  // INTERNAL ONLY — never added to DeckContract or ProposalDocument (leak-proof by design).
  assigned_to: number | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

const ESTIMATE_FIELDS = 'id, program_id, event_id, type, name, room_space, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override, include_in_budget, sort_order, included_in_proposal, venue_contact, menu_notes, transport_commission, venue_id, venue_space_id, discount_type, discount_value, eeg_enabled, eeg_rate, tax_exempt, food_tax_override, alcohol_tax_override, general_tax_override, slide_copy_data, tour_details, assigned_to, internal_notes, created_at, updated_at';

export async function getEstimatesForProgram(programId: string): Promise<DbEstimate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select(ESTIMATE_FIELDS)
    .eq('program_id', programId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEstimate(id: string): Promise<DbEstimate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select(ESTIMATE_FIELDS)
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

// ─── Line Items ───────────────────────────────────────────

// ─── Estimate Sections ────────────────────────────────────

export interface DbEstimateSection {
  id: string;
  estimate_id: string;
  name: string;
  tax_bucket: 'fb' | 'equipment' | 'venue' | 'staffing';
  markup_pct: number;
  sort_order: number;
  is_built_in: boolean;
}

const SECTION_FIELDS = 'id, estimate_id, name, tax_bucket, markup_pct, sort_order, is_built_in';

export async function getEstimateSections(estimateId: string): Promise<DbEstimateSection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_sections')
    .select(SECTION_FIELDS)
    .eq('estimate_id', estimateId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertEstimateSection(
  section: Omit<DbEstimateSection, 'is_built_in'> & { is_built_in?: boolean }
): Promise<DbEstimateSection> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_sections')
    .upsert(section, { onConflict: 'id' })
    .select(SECTION_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteEstimateSection(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('estimate_sections').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Line Items ───────────────────────────────────────────

export interface DbLineItem {
  id: string;
  estimate_id: string;
  section: string;
  section_id: string | null;
  name: string;
  label: string | null;
  qty: number;
  unit_price: number;
  category_id: string | null;
  tax_type: string;
  custom_client_unit_price: number | null;
  markup_override: number | null;
  is_revenue_item: boolean;
  notes: string | null;
  sort_order: number;
  thumbnail_url: string | null;
  thumbnail_icon: string | null;
  package_options: import('@/types').PackageOptions | null;
  selected_package_id: string | null;
  created_at: string;
  updated_at: string;
}

const LINE_ITEM_FIELDS = 'id, estimate_id, section, section_id, name, label, qty, unit_price, category_id, tax_type, custom_client_unit_price, markup_override, is_revenue_item, notes, sort_order, thumbnail_url, thumbnail_icon, package_options, selected_package_id, created_at, updated_at';

export async function getLineItemsForEstimate(estimateId: string): Promise<DbLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_line_items')
    .select(LINE_ITEM_FIELDS)
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
    .select(LINE_ITEM_FIELDS)
    .in('estimate_id', estimateIds)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Profiles ─────────────────────────────────────────────

export interface DbProfile {
  id: string;
  user_id: string;
  role: 'user' | 'admin';
  name: string | null;
  created_at: string;
}

export async function getProfile(userId: string): Promise<DbProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, role, name, created_at')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data as DbProfile;
}

// ─── Travel Reference Data ────────────────────────────────

export interface DbDriveRoute {
  id: string;
  route_name: string;
  cost: number;
  updated_at: string;
}

export async function getDriveRoutes(): Promise<DbDriveRoute[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('drive_routes')
    .select('id, route_name, cost, updated_at')
    .order('route_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface DbTrainRoute {
  id: string;
  route_name: string;
  low_cost: number;
  high_cost: number;
  updated_at: string;
}

export async function getTrainRoutes(): Promise<DbTrainRoute[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('train_routes')
    .select('id, route_name, low_cost, high_cost, updated_at')
    .order('route_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface DbFlightType {
  id: string;
  type_name: string;
  low_cost: number;
  high_cost: number;
  updated_at: string;
}

export async function getFlightTypes(): Promise<DbFlightType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('flight_types')
    .select('id, type_name, low_cost, high_cost, updated_at')
    .order('type_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface DbHotelRate {
  id: string;
  market: string;
  low_rate: number;
  high_rate: number;
  updated_at: string;
}

export async function getHotelRates(): Promise<DbHotelRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('hotel_rates')
    .select('id, market, low_rate, high_rate, updated_at')
    .order('market');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface DbPerDiemRate {
  id: string;
  market_type: string;
  full_day: number;
  half_day: number;
  updated_at: string;
}

export async function getPerDiemRates(): Promise<DbPerDiemRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('per_diem_rates')
    .select('id, market_type, full_day, half_day, updated_at')
    .order('market_type');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface DbVehicleRate {
  id: string;
  market: string;
  sedan_hourly: number;
  sedan_airport: number;
  suv_hourly: number;
  suv_airport: number;
  sprinter_hourly: number;
  sprinter_airport: number;
  updated_at: string;
}

export async function getVehicleRates(): Promise<DbVehicleRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_rates')
    .select('id, market, sedan_hourly, sedan_airport, suv_hourly, suv_airport, sprinter_hourly, sprinter_airport, updated_at')
    .order('market');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Estimate Trips ───────────────────────────────────────

export interface DbTrip {
  id: string;
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
  created_at: string;
  updated_at: string;
}

export async function getTripsForEstimate(estimateId: string): Promise<DbTrip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_trips')
    .select('*')
    .eq('estimate_id', estimateId)
    .order('trip_number');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── All travel refs (for estimate page) ─────────────────

export interface TravelRefData {
  driveRoutes: DbDriveRoute[];
  trainRoutes: DbTrainRoute[];
  flightTypes: DbFlightType[];
  hotelRates: DbHotelRate[];
  perDiemRates: DbPerDiemRate[];
  vehicleRates: DbVehicleRate[];
}

export async function getTravelRefs(): Promise<TravelRefData> {
  const [driveRoutes, trainRoutes, flightTypes, hotelRates, perDiemRates, vehicleRates] =
    await Promise.all([
      getDriveRoutes(),
      getTrainRoutes(),
      getFlightTypes(),
      getHotelRates(),
      getPerDiemRates(),
      getVehicleRates(),
    ]);
  return { driveRoutes, trainRoutes, flightTypes, hotelRates, perDiemRates, vehicleRates };
}

// ─── Transportation Estimates ─────────────────────────────

export interface DbTransportVehicleRate {
  id: string;
  estimate_id: string;
  vehicle_type: string;
  hourly_rate: number;
  hour_minimum: number | null;
  sort_order: number;
}

export interface DbTransportScheduleRow {
  id: string;
  estimate_id: string;
  service_date: string | null;
  vehicle_rate_id: string | null;
  service_type: string;
  spot_time: string | null;
  start_time: string | null;
  end_time: string | null;
  qty: number;
  our_cost: number;
  client_cost: number;
  notes: string | null;
  sort_order: number;
}

export async function getTransportVehicleRates(estimateId: string): Promise<DbTransportVehicleRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transport_vehicle_rates')
    .select('id, estimate_id, vehicle_type, hourly_rate, hour_minimum, sort_order')
    .eq('estimate_id', estimateId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTransportScheduleRows(estimateId: string): Promise<DbTransportScheduleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transport_schedule_rows')
    .select('id, estimate_id, service_date, vehicle_rate_id, service_type, spot_time, start_time, end_time, qty, our_cost, client_cost, notes, sort_order')
    .eq('estimate_id', estimateId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface TransportAggregate {
  estimate_id: string;
  total_our: number;
  total_client: number;
}

export async function getTransportAggregatesForProgram(programId: string): Promise<TransportAggregate[]> {
  const supabase = await createClient();
  const { data: estimates } = await supabase
    .from('estimates')
    .select('id')
    .eq('program_id', programId)
    .eq('type', 'transportation');

  if (!estimates || estimates.length === 0) return [];

  const ids = estimates.map((e) => e.id);
  const { data, error } = await supabase
    .from('transport_schedule_rows')
    .select('estimate_id, our_cost, client_cost')
    .in('estimate_id', ids);

  if (error || !data) return [];

  const map: Record<string, { total_our: number; total_client: number }> = {};
  for (const row of data) {
    if (!map[row.estimate_id]) map[row.estimate_id] = { total_our: 0, total_client: 0 };
    map[row.estimate_id].total_our += row.our_cost;
    map[row.estimate_id].total_client += row.client_cost;
  }
  return Object.entries(map).map(([estimate_id, v]) => ({ estimate_id, ...v }));
}

// ─── Venues ───────────────────────────────────────────────

export interface DbVenue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  service_styles: string[];
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  email_signature: string | null;
  website: string | null;
  market: string | null;
  notes: string | null;
  last_used_date: string | null;
  vendor_type: 'venue' | 'restaurant' | 'tour' | 'transportation' | 'entertainment' | 'decor';
  // Fee defaults — venue-level rates applied to all events at this vendor
  service_charge_default: number | null;
  gratuity_default: number | null;
  admin_fee_default: number | null;
  // Profile content columns (JSONB) — display/brochure data, NOT pricing inputs
  menus: unknown;
  bar_options: unknown;
  inclusions: unknown;
  profile_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbVenueSpace {
  id: string;
  venue_id: string;
  name: string;
  capacity_seated: number | null;
  capacity_standing: number | null;
  fb_minimum: number;
  room_fee: number;
  privacy_tag: 'private' | 'semi_private' | 'main_dining' | null;
  is_suggested: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbVenueWithSpaces extends DbVenue {
  spaces: DbVenueSpace[];
}

const VENUE_FIELDS = 'id, name, address, city, state, zip, service_styles, contact_name, contact_title, contact_email, contact_phone, email_signature, website, market, notes, last_used_date, vendor_type, service_charge_default, gratuity_default, admin_fee_default, menus, bar_options, inclusions, profile_notes, created_at, updated_at';
const SPACE_FIELDS = 'id, venue_id, name, capacity_seated, capacity_standing, fb_minimum, room_fee, privacy_tag, is_suggested, notes, created_at, updated_at';

export async function getVenues(): Promise<DbVenue[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('venues')
    .select(VENUE_FIELDS)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getVenue(id: string): Promise<DbVenue | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('venues')
    .select(VENUE_FIELDS)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as DbVenue;
}

export async function getVenueSpaces(venueId: string): Promise<DbVenueSpace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('venue_spaces')
    .select(SPACE_FIELDS)
    .eq('venue_id', venueId)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllVenueSpaces(): Promise<DbVenueSpace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('venue_spaces')
    .select(SPACE_FIELDS)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getVenueWithSpaces(id: string): Promise<DbVenueWithSpaces | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('venues')
    .select(`${VENUE_FIELDS}, spaces:venue_spaces(${SPACE_FIELDS})`)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as DbVenueWithSpaces;
}

// Filtered to vendor_type IN ('venue','restaurant') — used by the estimate picker.
// Other vendor types are not linkable to estimates.
export async function getVenuePickerVendors(): Promise<DbVenue[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('venues')
    .select(VENUE_FIELDS)
    .in('vendor_type', ['venue', 'restaurant'])
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Venue History ────────────────────────────────────────

export interface DbVenueEstimate {
  id: string;
  name: string;
  type: string;
  program_id: string;
  program_name: string;
  client_name: string | null;
  event_date: string | null;
  created_at: string;
}

export interface DbVenueAttachment {
  id: string;
  estimate_id: string;
  estimate_name: string;
  program_id: string;
  program_name: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  created_at: string;
}

export interface DbVenueStat {
  venue_id: string;
  program_count: number;
  file_count: number;
}

export async function getEstimatesForVenue(venueId: string): Promise<{ data: DbVenueEstimate[]; error: string | null; totalEstimatesAtVenue: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('id, name, type, program_id, created_at, program:programs(name, client_name, event_date)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message, totalEstimatesAtVenue: 0 };
  const rows = (data ?? []).map((row) => {
    const prog = row.program as unknown as { name: string; client_name: string | null; event_date: string | null } | null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      program_id: row.program_id,
      program_name: prog?.name ?? 'Unknown Program',
      client_name: prog?.client_name ?? null,
      event_date: prog?.event_date ?? null,
      created_at: row.created_at,
    };
  });
  return { data: rows, error: null, totalEstimatesAtVenue: rows.length };
}

export async function getAttachmentsForVenue(venueId: string): Promise<{ data: DbVenueAttachment[]; error: string | null }> {
  const supabase = await createClient();
  // Step 1: Get estimate IDs linked to this venue
  const { data: estimates, error: estErr } = await supabase
    .from('estimates')
    .select('id, name, program_id, program:programs(name)')
    .eq('venue_id', venueId);
  if (estErr) return { data: [], error: estErr.message };
  if (!estimates || estimates.length === 0) return { data: [], error: null };

  const estimateIds = estimates.map((e) => e.id);
  const estMap = new Map(estimates.map((e) => [
    e.id,
    { name: e.name, program_id: e.program_id, program_name: (e.program as unknown as { name: string } | null)?.name ?? '' },
  ]));

  const { data: attachments, error: attErr } = await supabase
    .from('estimate_attachments')
    .select('id, estimate_id, file_name, storage_path, mime_type, created_at')
    .in('estimate_id', estimateIds)
    .order('created_at', { ascending: false });
  if (attErr) return { data: [], error: attErr.message };

  return {
    data: (attachments ?? []).map((att) => {
      const est = estMap.get(att.estimate_id);
      return {
        id: att.id,
        estimate_id: att.estimate_id,
        estimate_name: est?.name ?? '',
        program_id: est?.program_id ?? '',
        program_name: est?.program_name ?? '',
        file_name: att.file_name,
        storage_path: att.storage_path,
        mime_type: att.mime_type,
        created_at: att.created_at,
      };
    }),
    error: null,
  };
}

export async function getVenueStats(): Promise<DbVenueStat[]> {
  const supabase = await createClient();
  const { data: estimates } = await supabase
    .from('estimates')
    .select('id, venue_id, program_id')
    .not('venue_id', 'is', null);
  if (!estimates || estimates.length === 0) return [];

  const programsByVenue = new Map<string, Set<string>>();
  const estimateIds: string[] = [];
  for (const est of estimates) {
    if (!est.venue_id) continue;
    estimateIds.push(est.id);
    if (!programsByVenue.has(est.venue_id)) programsByVenue.set(est.venue_id, new Set());
    programsByVenue.get(est.venue_id)!.add(est.program_id);
  }

  const filesByVenue = new Map<string, number>();
  if (estimateIds.length > 0) {
    const { data: attachments } = await supabase
      .from('estimate_attachments')
      .select('estimate_id')
      .in('estimate_id', estimateIds);
    const estToVenue = new Map(estimates.map((e) => [e.id, e.venue_id!]));
    for (const att of (attachments ?? [])) {
      const venueId = estToVenue.get(att.estimate_id);
      if (!venueId) continue;
      filesByVenue.set(venueId, (filesByVenue.get(venueId) ?? 0) + 1);
    }
  }

  return [...programsByVenue.entries()].map(([venue_id, programs]) => ({
    venue_id,
    program_count: programs.size,
    file_count: filesByVenue.get(venue_id) ?? 0,
  }));
}

// ─── Vendor Photos ────────────────────────────────────────

import type { VendorPhoto } from '@/lib/vendors/profileTypes';
export type { VendorPhoto };

export async function getVendorPhotos(vendorId: string): Promise<VendorPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vendor_photos')
    .select('id, vendor_id, file_url, storage_path, caption, tag, sort_order, created_at')
    .eq('vendor_id', vendorId)
    .order('sort_order')
    .order('created_at');
  if (error) return [];
  return (data ?? []) as VendorPhoto[];
}

// ─── Leads ────────────────────────────────────────────────

export type { LeadStatus, LeadStatusGroup } from '@/lib/leads/constants';
export { OPEN_STATUSES, CLOSED_STATUSES } from '@/lib/leads/constants';

import type { LeadStatus, LeadStatusGroup } from '@/lib/leads/constants';
import { OPEN_STATUSES, CLOSED_STATUSES } from '@/lib/leads/constants';

export interface DbLead {
  id: string;
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
  client_id: string | null;
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
  parsed_by: string | null;
  scan_batch_id: string | null;
  organization_id: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const LEAD_FIELDS = [
  'id', 'client_name', 'end_company', 'end_client',
  'contact_name', 'client_contact_name', 'contact_email', 'contact_role',
  'third_party_company', 'third_party_contact', 'third_party_comm_notes',
  'client_id',
  'program_name', 'program_type', 'program_description',
  'start_date', 'end_date', 'rain_date', 'num_nights', 'guest_count',
  'city', 'state', 'hotel', 'venue', 'region',
  'lead_source', 'lead_source_type', 'source_advisor', 'source_coordinator', 'sales_coordinator',
  'source_commission', 'third_party_commission', 'gdp_commission', 'extra_commission',
  'commission_notes', 'billing_notes', 'returning_client', 'special_instructions',
  'assigned_to', 'team_support', 'suggested_owner',
  'gdp_advisor', 'gdp_coordinator', 'third_party',
  'date_last_followup', 'current_due_date',
  'original_email_link', 'parsed_by', 'scan_batch_id', 'organization_id',
  'status', 'created_at', 'updated_at', 'archived_at',
].join(', ');

export async function getLeads(): Promise<DbLead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_FIELDS)
    .order('start_date', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DbLead[];
}

export async function getLead(id: string): Promise<DbLead | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('leads').select(LEAD_FIELDS).eq('id', id).single();
  if (error) return null;
  return data as unknown as DbLead;
}

export async function getLeadCounts(): Promise<Record<LeadStatusGroup, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('leads').select('status');
  if (error || !data) return { all: 0, open: 0, closed: 0 };
  const openSet = new Set<string>(OPEN_STATUSES);
  const closedSet = new Set<string>(CLOSED_STATUSES);
  const counts = { all: 0, open: 0, closed: 0 };
  for (const row of data) {
    const s = row.status as string;
    counts.all++;
    if (openSet.has(s)) counts.open++;
    else if (closedSet.has(s)) counts.closed++;
  }
  return counts;
}

/**
 * Returns the single program linked to a lead (one-per-lead enforced by
 * the UNIQUE constraint added in migration 034). Returns null if none.
 */
export async function getProgramsForLead(leadId: string): Promise<{ id: string; name: string; event_date: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, event_date')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

/**
 * Returns a Record<leadId, program> for ALL leads that have a linked program.
 * Used by the Kanban board to render converted lead cards as program cards.
 */
export interface LinkedProgramSummary {
  id: string;
  name: string;
  event_date: string | null;
  guest_count: number;
  program_status: string;
  program_type: string | null;
  staffing_needs_count: number;
}

export async function getLinkedProgramsByLeadId(): Promise<Record<string, LinkedProgramSummary>> {
  const supabase = await createClient();
  const [programsResult, staffingResult] = await Promise.all([
    supabase
      .from('programs')
      .select('id, name, event_date, guest_count, status, lead_id, program_type')
      .not('lead_id', 'is', null),
    supabase
      .from('program_staffing')
      .select('program_id')
      .eq('status', 'needs_staffing'),
  ]);
  const openCounts: Record<string, number> = {};
  for (const row of staffingResult.data ?? []) {
    openCounts[row.program_id] = (openCounts[row.program_id] ?? 0) + 1;
  }
  const result: Record<string, LinkedProgramSummary> = {};
  for (const p of programsResult.data ?? []) {
    if (p.lead_id) {
      result[p.lead_id] = {
        id: p.id,
        name: p.name,
        event_date: p.event_date,
        guest_count: p.guest_count,
        program_status: p.status,
        program_type: (p as unknown as { program_type: string | null }).program_type ?? null,
        staffing_needs_count: openCounts[p.id] ?? 0,
      };
    }
  }
  return result;
}

// ─── Clients / unified deal (Phase 2) ─────────────────────
// A deal = one client_id. getDealByClientId assembles the shared client row plus its
// lead (0 or 1) and program (0 or 1). Handles all 3 shapes: lone lead, lead+program
// pair, and standalone program. The unified deal page (2B) is built on this query.

export interface DbClient {
  id: string;
  client_name: string | null;
  company_name: string | null;
  end_client: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  client_contact_name: string | null;
  third_party_company: string | null;
  third_party_contact: string | null;
  third_party: string | null;
  third_party_comm_notes: string | null;
  client_commission: number | null;
  gdp_commission_rate: number | null;
  gdp_commission: number | null;
  extra_commission: number | null;
  commission_notes: string | null;
  billing_notes: string | null;
  returning_client: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  client: DbClient | null;
  lead: DbLead | null;
  program: DbProgramWithLocation | null;
}

export async function getDealByClientId(clientId: string): Promise<Deal> {
  const supabase = await createClient();
  // limit(1) + take-first (not .single()/.maybeSingle()) so the query never throws if a
  // client somehow has >1 lead or >1 program — newest wins.
  const [clientRes, leadRes, programRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).limit(1),
    supabase
      .from('leads')
      .select(LEAD_FIELDS)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('programs')
      .select(`
        id, name, client_name, event_date, guest_count, service_style,
        alcohol_type, event_time, event_start_time, event_end_time, company_name, client_hotel,
        location_id, cc_processing_fee, client_commission,
        gdp_commission_enabled, gdp_commission_rate,
        service_charge_default, gratuity_default, admin_fee_default,
        third_party_commissions, status, archived_at, include_travel_in_production_fee, lead_id, program_type, created_at, updated_at,
        location:locations(id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate, effective_date, updated_at)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  return {
    client: (clientRes.data?.[0] as unknown as DbClient) ?? null,
    lead: (leadRes.data?.[0] as unknown as DbLead) ?? null,
    program: (programRes.data?.[0] as unknown as DbProgramWithLocation) ?? null,
  };
}

// ─── Staffing ─────────────────────────────────────────────

export type StaffingStatus = 'needs_staffing' | 'assigned' | 'confirmed';

export interface DbStaffingRole {
  id: string;
  program_id: string;
  role: string;
  assigned_to: number | null;
  status: StaffingStatus;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getStaffingForProgram(programId: string): Promise<DbStaffingRole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('program_staffing')
    .select('*')
    .eq('program_id', programId)
    .order('sort_order');
  if (error) return [];
  return (data ?? []) as unknown as DbStaffingRole[];
}

export interface DbTeamMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
}

export async function getTeamMembers(): Promise<DbTeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('id, first_name, last_name, email, role, is_active')
    .eq('is_active', true)
    .order('first_name');
  if (error) return [];
  return (data ?? []) as DbTeamMember[];
}

// ─── Budget Plan ──────────────────────────────────────────

export interface DbBudgetPlanEntry {
  id: string;
  program_id: string;
  entry_type: 'per_event' | 'pooled';
  label: string;
  linked_estimate_id: string | null;
  linked_event_id: string | null;
  pricing_basis: 'per_person' | 'flat';
  value_low: number;
  value_high: number;
  guest_low: number | null;
  guest_high: number | null;
  pinned_value: number | null;
  pool_total: number | null;
  sort_order: number;
  notes: string | null;
  comparison_mode: 'compare_each' | 'combine';
  created_at: string;
  updated_at: string;
}

export async function getBudgetPlanEntries(programId: string): Promise<DbBudgetPlanEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('budget_plan_entries')
    .select('*')
    .eq('program_id', programId)
    .order('sort_order');
  return (data ?? []) as DbBudgetPlanEntry[];
}

export async function getBudgetPlanEntryForEstimate(estimateId: string): Promise<DbBudgetPlanEntry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('budget_plan_entries')
    .select('*')
    .eq('linked_estimate_id', estimateId)
    .maybeSingle();
  return (data ?? null) as DbBudgetPlanEntry | null;
}

// ─── Budget Documents (client budget builder) ─────────────
// Returns null on any query error (e.g. migration 051 not yet run) so the page renders
// an empty "build budget" state rather than crashing.

import type { BudgetDocument, BudgetLine, BudgetMember, BudgetAggregation, BudgetTier } from '@/lib/budget/budgetDocument';

interface DbBudgetLineMemberRow {
  id: string;
  budget_line_id: string;
  source_estimate_id: string | null;
  tier: BudgetTier | null;
  label: string | null;
  derived_value: number;
  derived_pp: number;
  override_value: number | null;
  source_removed: boolean;
  rank: number;
  sort_order: number;
}

interface DbBudgetLineRow {
  id: string;
  budget_document_id: string;
  event_id: string | null;
  name: string;
  aggregation: BudgetAggregation;
  tiered: boolean;
  is_per_person: boolean;
  guest_count: number | null;
  is_optional: boolean;
  is_included: boolean;
  selected_member_id: string | null;
  notes: string | null;
  sort_order: number;
}

export async function getBudgetForProgram(programId: string): Promise<BudgetDocument | null> {
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from('budget_documents')
    .select('id, program_id, title, status, disclaimers')
    .eq('program_id', programId)
    .maybeSingle();
  if (error || !doc) return null;

  const { data: lineRows, error: linesErr } = await supabase
    .from('budget_lines')
    .select('id, budget_document_id, event_id, name, aggregation, tiered, is_per_person, guest_count, is_optional, is_included, selected_member_id, notes, sort_order')
    .eq('budget_document_id', doc.id)
    .order('sort_order');
  if (linesErr) return null;

  const lineRowsArr = (lineRows ?? []) as DbBudgetLineRow[];
  const lineIds = lineRowsArr.map((l) => l.id);

  let memberRows: DbBudgetLineMemberRow[] = [];
  if (lineIds.length > 0) {
    const { data, error: memErr } = await supabase
      .from('budget_line_members')
      .select('id, budget_line_id, source_estimate_id, tier, label, derived_value, derived_pp, override_value, source_removed, rank, sort_order')
      .in('budget_line_id', lineIds)
      .order('sort_order');
    if (memErr) return null;
    memberRows = (data ?? []) as DbBudgetLineMemberRow[];
  }

  const membersByLine = new Map<string, BudgetMember[]>();
  for (const r of memberRows) {
    const m: BudgetMember = {
      id: r.id,
      sourceEstimateId: r.source_estimate_id,
      tier: r.tier,
      label: r.label,
      derivedValue: Number(r.derived_value),
      derivedPp: Number(r.derived_pp),
      overrideValue: r.override_value == null ? null : Number(r.override_value),
      sourceRemoved: r.source_removed,
      rank: r.rank,
      sortOrder: r.sort_order,
    };
    (membersByLine.get(r.budget_line_id) ?? membersByLine.set(r.budget_line_id, []).get(r.budget_line_id)!).push(m);
  }

  const lines: BudgetLine[] = lineRowsArr.map((l) => ({
    id: l.id,
    eventId: l.event_id,
    name: l.name,
    aggregation: l.aggregation,
    tiered: l.tiered,
    isPerPerson: l.is_per_person,
    guestCount: l.guest_count,
    isOptional: l.is_optional,
    isIncluded: l.is_included,
    selectedMemberId: l.selected_member_id,
    notes: l.notes,
    sortOrder: l.sort_order,
    members: (membersByLine.get(l.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  return {
    id: doc.id,
    programId: doc.program_id,
    title: doc.title,
    status: doc.status,
    disclaimers: doc.disclaimers,
    lines,
  };
}

export interface ActiveBudgetShare {
  id: string;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

// Most-recent non-revoked share for a program's budget (metadata only — never the token/snapshot).
export async function getActiveBudgetShare(programId: string): Promise<ActiveBudgetShare | null> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('budget_documents')
    .select('id')
    .eq('program_id', programId)
    .maybeSingle();
  if (!doc) return null;
  const { data } = await supabase
    .from('budget_shares')
    .select('id, expires_at, revoked_at, view_count, last_viewed_at, created_at')
    .eq('budget_document_id', doc.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as ActiveBudgetShare | null;
}

// Central live-links dashboard (Feature B): every share link across all programs, with its
// program context + derived status. Metadata only — never the token or snapshot.
export type ShareLinkStatus = 'active' | 'revoked' | 'expired';
export interface ShareLinkRow {
  id: string;
  programId: string | null;
  programName: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  status: ShareLinkStatus;
}

export async function getAllShareLinks(): Promise<ShareLinkRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('budget_shares')
    .select('id, created_at, expires_at, revoked_at, view_count, last_viewed_at, budget_documents(program_id, programs(name))')
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  const now = Date.now();
  return data.map((r) => {
    const doc = (r.budget_documents as unknown) as { program_id: string | null; programs: { name: string } | null } | null;
    const status: ShareLinkStatus =
      r.revoked_at != null ? 'revoked'
      : new Date(r.expires_at).getTime() <= now ? 'expired'
      : 'active';
    return {
      id: r.id,
      programId: doc?.program_id ?? null,
      programName: doc?.programs?.name ?? 'Unknown program',
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      viewCount: r.view_count ?? 0,
      lastViewedAt: r.last_viewed_at,
      status,
    };
  });
}

// Client capture responses (Phase 3). Returns null/[] gracefully before migration 053 runs.
export interface BudgetResponseLineSelection {
  lineId: string;
  tier?: 'low' | 'mid' | 'high';
  guestCount?: number;
}
export interface BudgetResponseView {
  id: string;
  submittedAt: string;
  computedTotal: number;
  notes: string | null;
  lineSelections: BudgetResponseLineSelection[];
  categoryTargets: { eventId: string; amount: number }[];
  computedByEvent: Record<string, number>;
  // null = not yet opened by the team (a "new" response).
  viewedAt: string | null;
  // Names resolved from the share snapshot the client actually saw.
  lineNames: Record<string, string>;
  eventNames: Record<string, string>;
}

export async function getBudgetResponses(programId: string): Promise<BudgetResponseView[]> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('budget_documents')
    .select('id')
    .eq('program_id', programId)
    .maybeSingle();
  if (!doc) return [];

  const { data: shares, error: shareErr } = await supabase
    .from('budget_shares')
    .select('id, snapshot')
    .eq('budget_document_id', doc.id);
  if (shareErr || !shares || shares.length === 0) return [];

  const snapshotByShare = new Map(shares.map((s) => [s.id, s.snapshot]));
  const { data: responses, error: respErr } = await supabase
    .from('budget_share_responses')
    .select('id, share_id, selections, computed_total, client_notes, submitted_at, viewed_at')
    .in('share_id', shares.map((s) => s.id))
    .order('submitted_at', { ascending: false });
  if (respErr || !responses) return [];

  return responses.map((r) => {
    const snap = (snapshotByShare.get(r.share_id) ?? {}) as {
      lines?: { id: string; name: string }[];
      events?: { id: string; name: string }[];
    };
    const lineNames: Record<string, string> = {};
    for (const l of snap.lines ?? []) lineNames[l.id] = l.name;
    const eventNames: Record<string, string> = {};
    for (const e of snap.events ?? []) eventNames[e.id] = e.name;
    const sel = (r.selections ?? {}) as {
      lineSelections?: BudgetResponseLineSelection[];
      categoryTargets?: { eventId: string; amount: number }[];
      computedByEvent?: Record<string, number>;
    };
    return {
      id: r.id,
      submittedAt: r.submitted_at,
      computedTotal: Number(r.computed_total),
      notes: r.client_notes,
      lineSelections: sel.lineSelections ?? [],
      categoryTargets: sel.categoryTargets ?? [],
      computedByEvent: sel.computedByEvent ?? {},
      viewedAt: (r as { viewed_at?: string | null }).viewed_at ?? null,
      lineNames,
      eventNames,
    };
  });
}

// Global count of NEW (unviewed) client budget responses across all programs — the nav roll-up.
// Shared team pool. Returns 0 gracefully if migration 055 hasn't run yet.
export async function getUnreadResponseCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('budget_share_responses')
    .select('id', { count: 'exact', head: true })
    .is('viewed_at', null);
  if (error) return 0;
  return count ?? 0;
}

// New (unviewed) response count per program id — for the programs-list "N new" badge that lets
// the team click through from the nav roll-up to the program with new responses.
export async function getUnreadResponseCountByProgram(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('budget_share_responses')
    .select('id, budget_shares(budget_documents(program_id))')
    .is('viewed_at', null);
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const r of data) {
    const share = (r.budget_shares as unknown) as { budget_documents: { program_id: string | null } | null } | null;
    const programId = share?.budget_documents?.program_id;
    if (programId) counts[programId] = (counts[programId] ?? 0) + 1;
  }
  return counts;
}

// ─── Callouts ─────────────────────────────────────────────
// Issue-tracking + discussion on estimates. INTERNAL ONLY — these tables are never joined into
// RawEstimate / DeckContract / ProposalDocument, so callout text cannot reach a client document.

export interface DbCallout {
  id: string;
  estimate_id: string;
  event_id: string | null;
  program_id: string;
  text: string;
  category: string | null;
  status: string; // 'open' | 'resolved'
  created_by: number | null;
  owner: number | null;
  resolved_by: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCalloutReply {
  id: string;
  callout_id: string;
  author: number | null;
  text: string;
  created_at: string;
}

export interface DbCalloutWithReplies extends DbCallout {
  replies: DbCalloutReply[];
}

// Context-enriched callout for the dedicated /callouts page (names resolved for display + links).
export interface CalloutWithContext extends DbCalloutWithReplies {
  program_name: string | null;
  event_name: string | null;
  estimate_name: string | null;
}

const CALLOUT_FIELDS =
  'id, estimate_id, event_id, program_id, text, category, status, created_by, owner, resolved_by, resolved_at, created_at, updated_at';

async function attachReplies(callouts: DbCallout[]): Promise<DbCalloutWithReplies[]> {
  if (callouts.length === 0) return [];
  const supabase = await createClient();
  const ids = callouts.map((c) => c.id);
  const { data: replies } = await supabase
    .from('callout_replies')
    .select('id, callout_id, author, text, created_at')
    .in('callout_id', ids)
    .order('created_at', { ascending: true });
  const byCallout: Record<string, DbCalloutReply[]> = {};
  for (const r of (replies ?? []) as DbCalloutReply[]) {
    (byCallout[r.callout_id] ??= []).push(r);
  }
  return callouts.map((c) => ({ ...c, replies: byCallout[c.id] ?? [] }));
}

// All callouts for a program (powers per-estimate-card badges + in-context threads).
export async function getCalloutsForProgram(programId: string): Promise<DbCalloutWithReplies[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('callouts')
    .select(CALLOUT_FIELDS)
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return attachReplies((data ?? []) as DbCallout[]);
}

// Team-wide open callout count (nav badge). HEAD count — no rows transferred.
export async function getOpenCalloutCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('callouts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');
  if (error) return 0;
  return count ?? 0;
}

// Every callout across all programs, enriched with program/event/estimate names (dedicated page).
export async function getAllCalloutsWithContext(): Promise<CalloutWithContext[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('callouts')
    .select(CALLOUT_FIELDS)
    .order('created_at', { ascending: false });
  if (error) return [];
  const callouts = (data ?? []) as DbCallout[];
  if (callouts.length === 0) return [];

  const withReplies = await attachReplies(callouts);

  // Resolve names via bulk lookups (small volume; avoids fragile nested-FK select syntax).
  const programIds = [...new Set(callouts.map((c) => c.program_id))];
  const eventIds = [...new Set(callouts.map((c) => c.event_id).filter((x): x is string => !!x))];
  const estimateIds = [...new Set(callouts.map((c) => c.estimate_id))];

  const [progs, evs, ests] = await Promise.all([
    supabase.from('programs').select('id, name').in('id', programIds),
    eventIds.length ? supabase.from('events').select('id, name').in('id', eventIds) : Promise.resolve({ data: [] }),
    supabase.from('estimates').select('id, name').in('id', estimateIds),
  ]);

  const progName = new Map((progs.data ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
  const evName = new Map((evs.data ?? []).map((e: { id: string; name: string }) => [e.id, e.name]));
  const estName = new Map((ests.data ?? []).map((e: { id: string; name: string }) => [e.id, e.name]));

  return withReplies.map((c) => ({
    ...c,
    program_name: progName.get(c.program_id) ?? null,
    event_name: c.event_id ? evName.get(c.event_id) ?? null : null,
    estimate_name: estName.get(c.estimate_id) ?? null,
  }));
}

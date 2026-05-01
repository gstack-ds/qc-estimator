import { createClient } from './server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

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
  latest_total: number | null;
}

export async function getPrograms(): Promise<DbProgramSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, client_name, event_date, created_at, updated_at, latest_total, estimates(count)')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    client_name: p.client_name,
    event_date: p.event_date,
    created_at: p.created_at,
    updated_at: p.updated_at,
    latest_total: (p as unknown as { latest_total: number | null }).latest_total,
    estimate_count: (p.estimates as unknown as [{ count: number }])[0]?.count ?? 0,
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
      third_party_commissions, created_at, updated_at,
      location:locations(id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate, effective_date, updated_at)
    `)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as DbProgramWithLocation;
}

// ─── Events ───────────────────────────────────────────────

export interface DbEvent {
  id: string;
  program_id: string;
  name: string;
  event_date: string | null;
  start_time: string | null;
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
    .select('id, program_id, name, event_date, start_time, end_time, guest_count, event_type, description, sort_order, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as DbEvent;
}

export async function getEventsForProgram(programId: string): Promise<DbEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('id, program_id, name, event_date, start_time, end_time, guest_count, event_type, description, sort_order, created_at, updated_at')
    .eq('program_id', programId)
    .order('sort_order')
    .order('event_date', { nullsFirst: true });
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
  created_at: string;
  updated_at: string;
}

const ESTIMATE_FIELDS = 'id, program_id, event_id, type, name, room_space, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override, include_in_budget, sort_order, venue_contact, menu_notes, transport_commission, venue_id, venue_space_id, created_at, updated_at';

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

export interface DbLineItem {
  id: string;
  estimate_id: string;
  section: string;
  name: string;
  label: string | null;
  qty: number;
  unit_price: number;
  category_id: string | null;
  tax_type: string;
  custom_client_unit_price: number | null;
  markup_override: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const LINE_ITEM_FIELDS = 'id, estimate_id, section, name, label, qty, unit_price, category_id, tax_type, custom_client_unit_price, markup_override, notes, sort_order, created_at, updated_at';

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
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  last_used_date: string | null;
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
  service_charge_default: number | null;
  gratuity_default: number | null;
  admin_fee_default: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbVenueWithSpaces extends DbVenue {
  spaces: DbVenueSpace[];
}

const VENUE_FIELDS = 'id, name, address, city, state, zip, service_styles, contact_name, contact_email, contact_phone, website, notes, last_used_date, created_at, updated_at';

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
    .select('id, venue_id, name, capacity_seated, capacity_standing, fb_minimum, room_fee, service_charge_default, gratuity_default, admin_fee_default, notes, created_at, updated_at')
    .eq('venue_id', venueId)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllVenueSpaces(): Promise<DbVenueSpace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('venue_spaces')
    .select('id, venue_id, name, capacity_seated, capacity_standing, fb_minimum, room_fee, service_charge_default, gratuity_default, admin_fee_default, notes, created_at, updated_at')
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getVenueWithSpaces(id: string): Promise<DbVenueWithSpaces | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('venues')
    .select(`${VENUE_FIELDS}, spaces:venue_spaces(id, venue_id, name, capacity_seated, capacity_standing, fb_minimum, room_fee, service_charge_default, gratuity_default, admin_fee_default, notes, created_at, updated_at)`)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as DbVenueWithSpaces;
}

// ─── Leads ────────────────────────────────────────────────

export type LeadStatus = 'new_lead' | 'proposal' | 'under_contract' | 'archived';

export interface DbLead {
  id: string;
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
  parsed_by: string | null;
  scan_batch_id: string | null;
  organization_id: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const LEAD_FIELDS = [
  'id', 'client_name', 'end_company', 'contact_name', 'contact_email', 'contact_role',
  'third_party_company', 'third_party_contact', 'third_party_comm_notes',
  'program_name', 'program_type', 'program_description',
  'start_date', 'end_date', 'rain_date', 'num_nights', 'guest_count',
  'city', 'state', 'hotel', 'venue', 'region',
  'lead_source', 'source_advisor', 'source_coordinator',
  'source_commission', 'third_party_commission', 'commission_notes',
  'billing_notes', 'returning_client', 'special_instructions',
  'assigned_to', 'suggested_owner',
  'original_email_link', 'parsed_by', 'scan_batch_id', 'organization_id',
  'status', 'created_at', 'updated_at', 'archived_at',
].join(', ');

export async function getLeads(status?: LeadStatus): Promise<DbLead[]> {
  const supabase = await createClient();
  let q = supabase.from('leads').select(LEAD_FIELDS).order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DbLead[];
}

export async function getLead(id: string): Promise<DbLead | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('leads').select(LEAD_FIELDS).eq('id', id).single();
  if (error) return null;
  return data as unknown as DbLead;
}

export async function getLeadCounts(): Promise<Record<LeadStatus | 'all', number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('leads').select('status');
  if (error || !data) return { all: 0, new_lead: 0, proposal: 0, under_contract: 0, archived: 0 };
  const counts = { all: data.length, new_lead: 0, proposal: 0, under_contract: 0, archived: 0 };
  for (const row of data) counts[row.status as LeadStatus]++;
  return counts;
}

export async function getProgramForLead(leadId: string): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('programs').select('id, name').eq('lead_id', leadId).maybeSingle();
  return data ?? null;
}

export async function getTeamMembers(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const admin = createAdminClient(url, key);
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 100 });
  if (error || !data) return [];
  return data.users
    .filter((u) => !!u.email)
    .map((u) => {
      const meta = u.user_metadata as { full_name?: string } | undefined;
      if (meta?.full_name) return meta.full_name;
      const prefix = u.email!.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    })
    .sort();
}

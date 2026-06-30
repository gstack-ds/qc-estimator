// Shared read-only retrieval handlers (venues / vendor directory).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SearchVenuesArgs, GetByIdArgs } from './types';

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleSearchVenues(
  db: SupabaseClient,
  args: SearchVenuesArgs,
) {
  let query = db
    .from('venues')
    .select(
      'id, name, city, state, vendor_type, market, contact_name, contact_email, contact_phone, website, service_styles, service_charge_default, gratuity_default, admin_fee_default, last_used_date, updated_at'
    )
    .order('name')
    .limit(args.limit ?? 20);

  if (args.vendor_type) query = query.eq('vendor_type', args.vendor_type);
  if (args.market) query = query.eq('market', args.market);
  if (args.query) {
    query = query.or(`name.ilike.%${args.query}%,city.ilike.%${args.query}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`search_venues: ${error.message}`);

  return {
    count: (data ?? []).length,
    venues: (data ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      city: v.city,
      state: v.state,
      vendor_type: v.vendor_type,
      market: v.market,
      contact_name: v.contact_name,
      contact_email: v.contact_email,
      contact_phone: v.contact_phone,
      website: v.website,
      service_styles: v.service_styles,
      fee_defaults: {
        service_charge: v.service_charge_default,
        gratuity: v.gratuity_default,
        admin_fee: v.admin_fee_default,
      },
      last_used_date: v.last_used_date,
      updated_at: v.updated_at,
    })),
  };
}

export async function handleGetVenue(
  db: SupabaseClient,
  args: GetByIdArgs,
) {
  const [venueResult, spacesResult] = await Promise.all([
    db
      .from('venues')
      .select(
        'id, name, address, city, state, zip, vendor_type, market, contact_name, contact_title, contact_email, contact_phone, website, service_styles, notes, profile_notes, menus, bar_options, inclusions, service_charge_default, gratuity_default, admin_fee_default, last_used_date, created_at, updated_at'
      )
      .eq('id', args.id)
      .single(),
    db
      .from('venue_spaces')
      .select('id, name, capacity_seated, capacity_standing, fb_minimum, room_fee, privacy_tag, notes')
      .eq('venue_id', args.id)
      .order('name'),
  ]);

  if (venueResult.error) {
    if (venueResult.error.code === 'PGRST116') return null;
    throw new Error(`get_venue: ${venueResult.error.message}`);
  }
  if (spacesResult.error) throw new Error(`get_venue spaces: ${spacesResult.error.message}`);
  const venue = venueResult.data;
  if (!venue) return null;

  // Fetch estimate count for this venue (how many programs have used it) — enrichment, degrade gracefully
  const { count: estimateCount, error: countErr } = await db
    .from('estimates')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', args.id);
  if (countErr) console.error(`get_venue estimate_count: ${countErr.message}`);

  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    zip: venue.zip,
    vendor_type: venue.vendor_type,
    market: venue.market,
    contact: {
      name: venue.contact_name,
      title: venue.contact_title,
      email: venue.contact_email,
      phone: venue.contact_phone,
    },
    website: venue.website,
    service_styles: venue.service_styles,
    fee_defaults: {
      service_charge: venue.service_charge_default,
      gratuity: venue.gratuity_default,
      admin_fee: venue.admin_fee_default,
    },
    notes: venue.notes,
    profile_notes: venue.profile_notes,
    has_menus: venue.menus != null && Object.keys(venue.menus as object).length > 0,
    has_bar_options: venue.bar_options != null && (Array.isArray(venue.bar_options) ? (venue.bar_options as unknown[]).length > 0 : false),
    spaces: (spacesResult.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      capacity_seated: s.capacity_seated,
      capacity_standing: s.capacity_standing,
      fb_minimum: s.fb_minimum,
      room_fee: s.room_fee,
      privacy_tag: s.privacy_tag,
      notes: s.notes,
    })),
    estimate_count: countErr ? null : (estimateCount ?? 0),
    last_used_date: venue.last_used_date,
    created_at: venue.created_at,
    updated_at: venue.updated_at,
  };
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Venues ──────────────────────────────────────────────

export async function createVenue(data: {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  service_styles?: string[];
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  notes?: string | null;
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: venue, error } = await supabase
    .from('venues')
    .insert({ ...data, service_styles: data.service_styles ?? [] })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/venues');
  return { id: venue.id };
}

export async function updateVenue(id: string, data: {
  name?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  service_styles?: string[];
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  notes?: string | null;
  last_used_date?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('venues')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/venues');
  revalidatePath(`/venues/${id}`);
  return {};
}

export async function deleteVenue(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/venues');
  return {};
}

// ─── Venue Spaces ─────────────────────────────────────────

export async function createVenueSpace(venueId: string, data: {
  name: string;
  capacity_seated?: number | null;
  capacity_standing?: number | null;
  fb_minimum?: number;
  room_fee?: number;
  service_charge_default?: number | null;
  gratuity_default?: number | null;
  admin_fee_default?: number | null;
  notes?: string | null;
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: space, error } = await supabase
    .from('venue_spaces')
    .insert({ venue_id: venueId, ...data })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/venues/${venueId}`);
  return { id: space.id };
}

export async function updateVenueSpace(id: string, venueId: string, data: {
  name?: string;
  capacity_seated?: number | null;
  capacity_standing?: number | null;
  fb_minimum?: number;
  room_fee?: number;
  service_charge_default?: number | null;
  gratuity_default?: number | null;
  admin_fee_default?: number | null;
  notes?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('venue_spaces')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/venues/${venueId}`);
  return {};
}

export async function deleteVenueSpace(id: string, venueId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('venue_spaces').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/venues/${venueId}`);
  return {};
}

// ─── Link venue to estimate ───────────────────────────────

export async function linkVenueToEstimate(
  estimateId: string,
  programId: string,
  venueId: string | null,
  venueSpaceId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('estimates')
    .update({ venue_id: venueId, venue_space_id: venueSpaceId, updated_at: new Date().toISOString() })
    .eq('id', estimateId);
  if (error) return { error: error.message };

  if (venueId) {
    await supabase
      .from('venues')
      .update({ last_used_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
      .eq('id', venueId);
  }

  revalidatePath(`/programs/${programId}/estimates/${estimateId}`);
  return {};
}

// ─── Auto-link or create venue from estimate name ─────────

export async function autoLinkOrCreateVenue(
  estimateId: string,
  programId: string,
  estimateName: string,
  spaceData: {
    spaceName: string;
    fbMinimum: number;
    serviceChargeDefault: number | null;
    gratuityDefault: number | null;
    adminFeeDefault: number | null;
  },
): Promise<{ action: 'linked' | 'created' | 'skipped'; venueId: string | null; venueSpaceId: string | null; error?: string }> {
  const supabase = await createClient();

  // Fetch the estimate to check if already linked
  const { data: est } = await supabase
    .from('estimates')
    .select('venue_id, venue_space_id')
    .eq('id', estimateId)
    .single();
  if (est?.venue_id) {
    return { action: 'skipped', venueId: est.venue_id, venueSpaceId: est.venue_space_id };
  }

  const name = estimateName.trim();
  if (!name) return { action: 'skipped', venueId: null, venueSpaceId: null };

  // Look for an exact name match (case-insensitive)
  const { data: existing } = await supabase
    .from('venues')
    .select('id')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  let venueId: string;
  let venueSpaceId: string | null = null;

  if (existing) {
    venueId = existing.id;

    // Link estimate
    const { error: le } = await supabase
      .from('estimates')
      .update({ venue_id: venueId, venue_space_id: null, updated_at: new Date().toISOString() })
      .eq('id', estimateId);
    if (le) return { action: 'skipped', venueId: null, venueSpaceId: null, error: le.message };

    await supabase
      .from('venues')
      .update({ last_used_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
      .eq('id', venueId);

    revalidatePath(`/programs/${programId}/estimates/${estimateId}`);
    revalidatePath('/venues');
    return { action: 'linked', venueId, venueSpaceId: null };
  }

  // Create venue + space
  const { data: venue, error: ve } = await supabase
    .from('venues')
    .insert({ name, service_styles: [], last_used_date: new Date().toISOString().slice(0, 10) })
    .select('id')
    .single();
  if (ve || !venue) return { action: 'skipped', venueId: null, venueSpaceId: null, error: ve?.message };
  venueId = venue.id;

  const { data: space, error: se } = await supabase
    .from('venue_spaces')
    .insert({
      venue_id: venueId,
      name: spaceData.spaceName || name,
      fb_minimum: spaceData.fbMinimum,
      service_charge_default: spaceData.serviceChargeDefault,
      gratuity_default: spaceData.gratuityDefault,
      admin_fee_default: spaceData.adminFeeDefault,
    })
    .select('id')
    .single();
  if (!se && space) venueSpaceId = space.id;

  await supabase
    .from('estimates')
    .update({ venue_id: venueId, venue_space_id: venueSpaceId, updated_at: new Date().toISOString() })
    .eq('id', estimateId);

  revalidatePath(`/programs/${programId}/estimates/${estimateId}`);
  revalidatePath('/venues');
  return { action: 'created', venueId, venueSpaceId };
}

// ─── Sync venue space defaults from estimate ──────────────

export async function syncVenueSpaceDefaults(
  venueSpaceId: string,
  venueId: string,
  data: {
    fbMinimum: number;
    serviceChargeDefault: number | null;
    gratuityDefault: number | null;
    adminFeeDefault: number | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('venue_spaces')
    .update({
      fb_minimum: data.fbMinimum,
      service_charge_default: data.serviceChargeDefault,
      gratuity_default: data.gratuityDefault,
      admin_fee_default: data.adminFeeDefault,
      updated_at: new Date().toISOString(),
    })
    .eq('id', venueSpaceId);
  if (error) return { error: error.message };
  revalidatePath(`/venues/${venueId}`);
  return {};
}

// ─── Save estimate as new venue ───────────────────────────

export async function saveEstimateAsVenue(
  estimateId: string,
  programId: string,
  venueData: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    service_styles?: string[];
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    website?: string | null;
    notes?: string | null;
  },
  spaceData: {
    name: string;
    capacity_seated?: number | null;
    capacity_standing?: number | null;
    fb_minimum: number;
    room_fee?: number;
    service_charge_default?: number | null;
    gratuity_default?: number | null;
    admin_fee_default?: number | null;
  },
): Promise<{ venueId: string; spaceId: string } | { error: string }> {
  const supabase = await createClient();

  const { data: venue, error: ve } = await supabase
    .from('venues')
    .insert({ ...venueData, service_styles: venueData.service_styles ?? [], last_used_date: new Date().toISOString().slice(0, 10) })
    .select('id')
    .single();
  if (ve) return { error: ve.message };

  const { data: space, error: se } = await supabase
    .from('venue_spaces')
    .insert({ venue_id: venue.id, ...spaceData })
    .select('id')
    .single();
  if (se) return { error: se.message };

  const { error: ue } = await supabase
    .from('estimates')
    .update({ venue_id: venue.id, venue_space_id: space.id, updated_at: new Date().toISOString() })
    .eq('id', estimateId);
  if (ue) return { error: ue.message };

  revalidatePath('/venues');
  revalidatePath(`/programs/${programId}/estimates/${estimateId}`);
  return { venueId: venue.id, spaceId: space.id };
}

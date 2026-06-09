'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { normalizeAddress, normalizeName, normalizeCity } from '@/lib/venues/normalize';
import { validateVenueInput } from '@/lib/venues/validate';

// ─── Venues ──────────────────────────────────────────────

export async function createVenue(data: {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  service_styles?: string[];
  contact_name?: string | null;
  contact_title?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  email_signature?: string | null;
  website?: string | null;
  market?: string | null;
  notes?: string | null;
  vendor_type?: 'venue' | 'restaurant' | 'tour' | 'transportation' | 'entertainment' | 'decor';
  skipNameCheck?: boolean;
}): Promise<{ id: string } | { error: string; existingId?: string; existingName?: string; isWarning?: boolean }> {
  console.log('[createVenue] called with name=%s address=%s', data.name, data.address ?? '(none)');
  const supabase = await createClient();

  // Fetch existing venues for duplicate checks
  const { data: allVenues } = await supabase.from('venues').select('id, name, address');

  const validation = validateVenueInput(data, allVenues ?? [], data.skipNameCheck);

  if (!validation.ok) {
    console.log('[createVenue] blocked — reason=%s', validation.reason);
    if (validation.reason === 'missing_address') {
      return { error: 'Address is required. Enter the venue street address to prevent duplicates.' };
    }
    if (validation.reason === 'duplicate_address') {
      return {
        error: `This address already exists as "${validation.existingName}". Use that venue instead.`,
        existingId: validation.existingId,
        existingName: validation.existingName,
      };
    }
    if (validation.reason === 'similar_name') {
      return {
        error: `A venue with a similar name already exists: "${validation.existingName}". Did you mean that venue?`,
        existingId: validation.existingId,
        existingName: validation.existingName,
        isWarning: true,
      };
    }
  }

  // Exclude non-DB fields from insert
  const { skipNameCheck: _skip, ...insertData } = data;
  if (insertData.city) insertData.city = normalizeCity(insertData.city);
  const { data: venue, error } = await supabase
    .from('venues')
    .insert({ ...insertData, service_styles: insertData.service_styles ?? [] })
    .select('id')
    .single();
  if (error) {
    console.log('[createVenue] DB insert error:', error.message);
    return { error: error.message };
  }
  console.log('[createVenue] created id=%s', venue.id);
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
  contact_title?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  email_signature?: string | null;
  website?: string | null;
  market?: string | null;
  notes?: string | null;
  last_used_date?: string | null;
  vendor_type?: 'venue' | 'restaurant' | 'tour' | 'transportation' | 'entertainment' | 'decor';
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const patch = data.city ? { ...data, city: normalizeCity(data.city) } : data;
  const { error } = await supabase
    .from('venues')
    .update({ ...patch, updated_at: new Date().toISOString() })
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
  privacy_tag?: 'private' | 'semi_private' | 'main_dining' | null;
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
  privacy_tag?: 'private' | 'semi_private' | 'main_dining' | null;
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

// Escape PostgreSQL LIKE wildcards so literal % and _ in names don't match unintended rows
function escapeLike(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
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

  // Look for an exact name match (case-insensitive, LIKE wildcards escaped)
  const { data: existing } = await supabase
    .from('venues')
    .select('id')
    .ilike('name', escapeLike(name))
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
  if (!venueData.address?.trim()) {
    return { error: 'Address is required to save a venue.' };
  }
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


// ─── Merge vendors ────────────────────────────────────────

export interface MergeVendorsResult {
  survivorId: string;
  estimatesMoved: number;
  photosMoved: number;
  spacesRepointed: number;
  duplicateSpaces: Array<{ survivorSpaceId: string; loserSpaceId: string; name: string }>;
}

export async function mergeVendors(survivorId: string, loserId: string): Promise<{ data: MergeVendorsResult | null; error: string | null }> {
  if (survivorId === loserId) return { data: null, error: 'Survivor and loser must be different vendors.' };

  const supabase = await createClient();

  // Load both vendors and their spaces
  const [{ data: survivor, error: e1 }, { data: loser, error: e2 }] = await Promise.all([
    supabase.from('venues').select('*').eq('id', survivorId).single(),
    supabase.from('venues').select('*').eq('id', loserId).single(),
  ]);
  if (e1 || !survivor) return { data: null, error: e1?.message ?? 'Survivor not found' };
  if (e2 || !loser) return { data: null, error: e2?.message ?? 'Loser not found' };

  const [{ data: survivorSpaces }, { data: loserSpaces }] = await Promise.all([
    supabase.from('venue_spaces').select('id, name').eq('venue_id', survivorId),
    supabase.from('venue_spaces').select('id, name').eq('venue_id', loserId),
  ]);

  // Detect duplicate spaces before repointing
  const { detectDuplicateSpaces, mergeJsonb, mergeText } = await import('@/lib/vendors/mergeLogic');
  const sSpaces = survivorSpaces ?? [];
  const lSpaces = loserSpaces ?? [];
  const duplicateSpaces = detectDuplicateSpaces(sSpaces, lSpaces);
  const duplicateLoserIds = new Set(duplicateSpaces.map((d) => d.loserSpaceId));

  // Repoint estimates
  const { data: estimatesData } = await supabase
    .from('estimates').update({ venue_id: survivorId }).eq('venue_id', loserId).select('id');
  const estimatesMoved = estimatesData?.length ?? 0;

  // Repoint vendor_photos
  const { data: photosData } = await supabase
    .from('vendor_photos').update({ vendor_id: survivorId }).eq('vendor_id', loserId).select('id');
  const photosMoved = photosData?.length ?? 0;

  // Repoint non-duplicate spaces; delete duplicate loser spaces
  let spacesRepointed = 0;
  const spacesToRepoint = lSpaces.filter((s) => !duplicateLoserIds.has(s.id));
  if (spacesToRepoint.length > 0) {
    const { data: repointed } = await supabase
      .from('venue_spaces').update({ venue_id: survivorId }).in('id', spacesToRepoint.map((s) => s.id)).select('id');
    spacesRepointed = repointed?.length ?? 0;
  }
  if (duplicateLoserIds.size > 0) {
    await supabase.from('venue_spaces').delete().in('id', [...duplicateLoserIds]);
  }

  // Merge JSONB profile fields (survivor wins unless empty)
  const mergedMenus = mergeJsonb(survivor.menus, loser.menus);
  const mergedBarOptions = mergeJsonb(survivor.bar_options, loser.bar_options);
  const mergedInclusions = mergeJsonb(survivor.inclusions, loser.inclusions);

  // Merge nullable text fields
  const mergedAddress     = mergeText(survivor.address,      loser.address);
  const mergedCity        = mergeText(survivor.city,         loser.city);
  const mergedState       = mergeText(survivor.state,        loser.state);
  const mergedZip         = mergeText(survivor.zip,          loser.zip);
  const mergedMarket      = mergeText(survivor.market,       loser.market);
  const mergedContactName = mergeText(survivor.contact_name, loser.contact_name);
  const mergedContactTitle= mergeText(survivor.contact_title,loser.contact_title);
  const mergedContactEmail= mergeText(survivor.contact_email,loser.contact_email);
  const mergedContactPhone= mergeText(survivor.contact_phone,loser.contact_phone);
  const mergedEmailSig    = mergeText(survivor.email_signature, loser.email_signature);
  const mergedWebsite     = mergeText(survivor.website,      loser.website);
  const mergedNotes       = mergeText(survivor.notes,        loser.notes);
  const mergedProfileNotes= mergeText(survivor.profile_notes,loser.profile_notes);

  // Update survivor with merged fields
  const { error: updateErr } = await supabase.from('venues').update({
    address:       mergedAddress,
    city:          mergedCity,
    state:         mergedState,
    zip:           mergedZip,
    market:        mergedMarket,
    contact_name:  mergedContactName,
    contact_title: mergedContactTitle,
    contact_email: mergedContactEmail,
    contact_phone: mergedContactPhone,
    email_signature: mergedEmailSig,
    website:       mergedWebsite,
    notes:         mergedNotes,
    profile_notes: mergedProfileNotes,
    menus:         mergedMenus,
    bar_options:   mergedBarOptions,
    inclusions:    mergedInclusions,
  }).eq('id', survivorId);
  if (updateErr) return { data: null, error: updateErr.message };

  // Delete loser (cascades vendor_photos, remaining venue_spaces via ON DELETE CASCADE)
  const { error: deleteErr } = await supabase.from('venues').delete().eq('id', loserId);
  if (deleteErr) return { data: null, error: deleteErr.message };

  revalidatePath('/vendors');
  revalidatePath(`/venues/${survivorId}`);

  return {
    data: { survivorId, estimatesMoved, photosMoved, spacesRepointed, duplicateSpaces },
    error: null,
  };
}

// ─── Bulk update vendors ──────────────────────────────────

export async function bulkUpdateVendors(
  ids: string[],
  updates: { vendor_type?: string; market?: string },
): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const supabase = await createClient();
  const payload: Record<string, string> = {};
  if (updates.vendor_type) payload.vendor_type = updates.vendor_type;
  if (updates.market !== undefined) payload.market = updates.market;
  if (Object.keys(payload).length === 0) return { error: null };
  const { error } = await supabase.from('venues').update(payload).in('id', ids);
  if (error) return { error: error.message };
  revalidatePath('/vendors');
  return { error: null };
}

// ─── Markets ──────────────────────────────────────────────

export async function createMarket(name: string): Promise<{ name: string | null; error: string | null }> {
  const supabase = await createClient();
  const trimmed = name.trim();
  if (!trimmed) return { name: null, error: 'Market name is required' };
  const { error } = await supabase.from('markets').insert({ name: trimmed });
  if (error) return { name: null, error: error.message };
  revalidatePath('/venues');
  return { name: trimmed, error: null };
}

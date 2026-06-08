'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { VendorMenu, BarOption, VendorInclusion, PhotoTag } from '@/lib/vendors/profileTypes';

// ── Profile content (menus, bar, inclusions, notes) ───────────────────────────
// Saves all four profile fields in one round-trip.

export async function saveVendorProfile(
  vendorId: string,
  data: {
    menus: VendorMenu[];
    bar_options: BarOption[];
    inclusions: VendorInclusion[];
    profile_notes: string;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('venues')
    .update({
      menus:         data.menus,
      bar_options:   data.bar_options,
      inclusions:    data.inclusions,
      profile_notes: data.profile_notes.trim() || null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', vendorId);
  if (error) return { error: error.message };
  revalidatePath(`/venues/${vendorId}`);
  return {};
}

// ── Vendor Photos ─────────────────────────────────────────────────────────────

export async function addVendorPhoto(
  vendorId: string,
  data: {
    file_url: string;
    storage_path: string;
    caption?: string | null;
    tag?: PhotoTag;
    sort_order: number;
  },
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: photo, error } = await supabase
    .from('vendor_photos')
    .insert({ vendor_id: vendorId, tag: 'other', ...data })
    .select('id')
    .single();
  if (error || !photo) return { error: error?.message ?? 'Insert failed' };
  revalidatePath(`/venues/${vendorId}`);
  return { id: photo.id };
}

export async function updateVendorPhoto(
  photoId: string,
  vendorId: string,
  data: { caption?: string | null; tag?: PhotoTag },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('vendor_photos').update(data).eq('id', photoId);
  if (error) return { error: error.message };
  revalidatePath(`/venues/${vendorId}`);
  return {};
}

export async function deleteVendorPhoto(
  photoId: string,
  vendorId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  await supabase.storage.from('vendor-photos').remove([storagePath]);
  const { error } = await supabase.from('vendor_photos').delete().eq('id', photoId);
  if (error) return { error: error.message };
  revalidatePath(`/venues/${vendorId}`);
  return {};
}

export async function reorderVendorPhotos(
  vendorId: string,
  photos: Array<{ id: string; sort_order: number }>,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const results = await Promise.all(
    photos.map(({ id, sort_order }) =>
      supabase.from('vendor_photos').update({ sort_order }).eq('id', id),
    ),
  );
  const firstError = results.find((r) => r.error);
  if (firstError?.error) return { error: firstError.error.message };
  revalidatePath(`/venues/${vendorId}`);
  return {};
}

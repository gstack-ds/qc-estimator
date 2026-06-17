-- Migration 049: storage bucket + RLS policies for line-item thumbnail uploads.
--
-- ROOT CAUSE of "new row violates row-level security policy":
-- uploadLineItemThumbnail() uploads to the 'line-item-thumbnails' storage bucket, but no
-- migration ever created that bucket's storage.objects RLS policies. Migration 027 only added
-- the thumbnail_url/thumbnail_icon COLUMNS on estimate_line_items — it never set up the bucket.
-- storage.objects has RLS enabled, so without an INSERT (WITH CHECK) policy for this bucket,
-- every upload's insert into storage.objects is rejected. The working uploads
-- (estimate-attachments → migration 006, vendor-photos → migration 042) each have explicit
-- storage.objects policies; this bucket was missing them.
--
-- Fix mirrors the vendor-photos setup (042): create the bucket if absent, public read,
-- authenticated insert/update/delete. uploadLineItemThumbnail uses upsert:true, so both INSERT
-- and UPDATE policies are required. Idempotent (safe to re-run).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'line-item-thumbnails',
  'line-item-thumbnails',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read access for line item thumbnails" ON storage.objects;
CREATE POLICY "public read access for line item thumbnails"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'line-item-thumbnails');

DROP POLICY IF EXISTS "authenticated users can upload line item thumbnails" ON storage.objects;
CREATE POLICY "authenticated users can upload line item thumbnails"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'line-item-thumbnails');

DROP POLICY IF EXISTS "authenticated users can update line item thumbnails" ON storage.objects;
CREATE POLICY "authenticated users can update line item thumbnails"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'line-item-thumbnails');

DROP POLICY IF EXISTS "authenticated users can delete line item thumbnails" ON storage.objects;
CREATE POLICY "authenticated users can delete line item thumbnails"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'line-item-thumbnails');

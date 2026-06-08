-- 042_vendor_profile.sql
-- Vendor Phase 2: profile content (menus, bar, inclusions) + photo gallery.
-- All new columns are display/brochure data only — do NOT feed the pricing engine.

-- ── Profile JSONB columns on venues ──────────────────────────────────────────

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS menus         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bar_options   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS inclusions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_notes TEXT;

-- ── vendor_photos table ───────────────────────────────────────────────────────

CREATE TABLE vendor_photos (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id    UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  file_url     TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  caption      TEXT,
  tag          TEXT        CHECK (tag IN ('space', 'food', 'ambiance', 'other')) DEFAULT 'other',
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX vendor_photos_vendor_id_idx ON vendor_photos(vendor_id);

ALTER TABLE vendor_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage vendor photos"
  ON vendor_photos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Storage bucket for vendor photos ─────────────────────────────────────────
-- Public bucket: images displayed directly without signed URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-photos',
  'vendor-photos',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read access for vendor photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'vendor-photos');

CREATE POLICY "authenticated users can upload vendor photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-photos');

CREATE POLICY "authenticated users can update vendor photo objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-photos');

CREATE POLICY "authenticated users can delete vendor photo objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-photos');

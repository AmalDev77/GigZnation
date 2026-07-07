
-- Add missing columns to artist_profiles
ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS cover_photo_url text,
  ADD COLUMN IF NOT EXISTS media_urls jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS availability jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS min_price numeric,
  ADD COLUMN IF NOT EXISTS max_price numeric;

-- Create storage bucket for artist media
INSERT INTO storage.buckets (id, name, public) VALUES ('artist-media', 'artist-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anyone can view
CREATE POLICY "Public read artist media" ON storage.objects FOR SELECT USING (bucket_id = 'artist-media');
-- Authenticated users can upload their own
CREATE POLICY "Artists upload own media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artist-media' AND (storage.foldername(name))[1] = auth.uid()::text);
-- Artists can delete their own
CREATE POLICY "Artists delete own media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artist-media' AND (storage.foldername(name))[1] = auth.uid()::text);

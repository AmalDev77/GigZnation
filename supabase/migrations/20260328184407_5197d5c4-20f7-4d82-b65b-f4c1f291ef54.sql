
ALTER TABLE public.venue_profiles
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS cover_photo_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS operating_hours_start time,
  ADD COLUMN IF NOT EXISTS operating_hours_end time,
  ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '{}'::jsonb;

-- Storage bucket for venue media
INSERT INTO storage.buckets (id, name, public) VALUES ('venue-media', 'venue-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read venue media" ON storage.objects FOR SELECT USING (bucket_id = 'venue-media');
CREATE POLICY "Venues upload own media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'venue-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Venues delete own media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'venue-media' AND (storage.foldername(name))[1] = auth.uid()::text);

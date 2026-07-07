
ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;

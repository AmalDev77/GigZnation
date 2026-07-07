ALTER TABLE public.artist_ratings_by_admin 
ADD COLUMN IF NOT EXISTS category_ratings jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
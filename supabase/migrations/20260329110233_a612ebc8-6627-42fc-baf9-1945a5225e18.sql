-- Allow public read of admin reviews with public visibility
CREATE POLICY "Public can view public admin artist ratings"
ON public.artist_ratings_by_admin
FOR SELECT
TO public
USING (visibility = 'public');

CREATE POLICY "Public can view public admin venue ratings"
ON public.venue_ratings_by_admin
FOR SELECT
TO public
USING (visibility = 'public');

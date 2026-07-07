
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS category_ratings jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS visible boolean DEFAULT false;

CREATE OR REPLACE FUNCTION public.check_and_reveal_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  other_exists boolean;
BEGIN
  -- Check if the other party has also reviewed for the same booking
  SELECT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE booking_id = NEW.booking_id
      AND reviewer_id != NEW.reviewer_id
  ) INTO other_exists;

  IF other_exists THEN
    -- Make both reviews visible
    UPDATE public.reviews SET visible = true WHERE booking_id = NEW.booking_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_reveal_reviews
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.check_and_reveal_reviews();

-- Function to recalculate aggregate rating
CREATE OR REPLACE FUNCTION public.recalculate_artist_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  avg_rating numeric;
  artist_profile_id uuid;
BEGIN
  -- Find if reviewee is an artist
  SELECT id INTO artist_profile_id FROM public.artist_profiles WHERE id = NEW.reviewee_id;
  
  IF artist_profile_id IS NOT NULL THEN
    SELECT COALESCE(AVG(rating), 0) INTO avg_rating
    FROM public.reviews
    WHERE reviewee_id = artist_profile_id AND visible = true;
    
    UPDATE public.artist_profiles SET rating = ROUND(avg_rating, 1) WHERE id = artist_profile_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_recalculate_rating
AFTER UPDATE OF visible ON public.reviews
FOR EACH ROW
WHEN (NEW.visible = true)
EXECUTE FUNCTION public.recalculate_artist_rating();


-- 1. Artist Profiles
CREATE TABLE public.artist_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_name text,
  genre text,
  city text,
  bio text,
  portfolio_url text,
  price_per_hour numeric,
  rating numeric DEFAULT 0,
  total_gigs integer DEFAULT 0,
  verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view artist profiles" ON public.artist_profiles FOR SELECT USING (true);
CREATE POLICY "Artists can insert own profile" ON public.artist_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Artists can update own profile" ON public.artist_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 2. Venue Profiles
CREATE TABLE public.venue_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_name text,
  city text,
  address text,
  capacity integer,
  venue_type text,
  description text,
  rating numeric DEFAULT 0,
  verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.venue_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view venue profiles" ON public.venue_profiles FOR SELECT USING (true);
CREATE POLICY "Venues can insert own profile" ON public.venue_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Venues can update own profile" ON public.venue_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 3. Gig Posts (venues post gigs, artists apply)
CREATE TABLE public.gig_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venue_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  genre text,
  city text,
  date date,
  start_time time,
  end_time time,
  budget numeric,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gig_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view open gigs" ON public.gig_posts FOR SELECT USING (true);
CREATE POLICY "Venue owners can insert gigs" ON public.gig_posts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.venue_profiles WHERE id = venue_id AND user_id = auth.uid()));
CREATE POLICY "Venue owners can update own gigs" ON public.gig_posts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venue_profiles WHERE id = venue_id AND user_id = auth.uid()));
CREATE POLICY "Venue owners can delete own gigs" ON public.gig_posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venue_profiles WHERE id = venue_id AND user_id = auth.uid()));

-- 4. Applications (artists apply to gigs)
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gig_posts(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gig_id, artist_id)
);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Artists can view own applications" ON public.applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artist_profiles WHERE id = artist_id AND user_id = auth.uid()));
CREATE POLICY "Venue owners can view applications for their gigs" ON public.applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gig_posts g JOIN public.venue_profiles v ON g.venue_id = v.id WHERE g.id = gig_id AND v.user_id = auth.uid()));
CREATE POLICY "Artists can insert applications" ON public.applications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_profiles WHERE id = artist_id AND user_id = auth.uid()));
CREATE POLICY "Artists can update own applications" ON public.applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artist_profiles WHERE id = artist_id AND user_id = auth.uid()));

-- 5. Bookings
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid REFERENCES public.gig_posts(id) ON DELETE SET NULL,
  artist_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venue_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  amount numeric,
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Artists can view own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artist_profiles WHERE id = artist_id AND user_id = auth.uid()));
CREATE POLICY "Venues can view own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venue_profiles WHERE id = venue_id AND user_id = auth.uid()));
CREATE POLICY "Venues can insert bookings" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.venue_profiles WHERE id = venue_id AND user_id = auth.uid()));
CREATE POLICY "Booking parties can update" ON public.bookings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artist_profiles WHERE id = artist_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.venue_profiles WHERE id = venue_id AND user_id = auth.uid()));

-- 6. Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can mark own messages read" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- 7. Reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id, reviewer_id)
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert reviews for their bookings" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- 8. Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'general',
  read boolean DEFAULT false,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Updated_at triggers
CREATE TRIGGER update_artist_profiles_updated_at BEFORE UPDATE ON public.artist_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_venue_profiles_updated_at BEFORE UPDATE ON public.venue_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gig_posts_updated_at BEFORE UPDATE ON public.gig_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

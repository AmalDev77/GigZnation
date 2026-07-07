
-- Admin users table
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  permissions jsonb DEFAULT '{}',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view admin_users" ON public.admin_users FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can insert admin_users" ON public.admin_users FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can update admin_users" ON public.admin_users FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Admin actions log
CREATE TABLE public.admin_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view actions log" ON public.admin_actions_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can insert actions log" ON public.admin_actions_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Artist ratings by admin
CREATE TABLE public.artist_ratings_by_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  rating integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artist_ratings_by_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can manage artist ratings" ON public.artist_ratings_by_admin FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Venue ratings by admin
CREATE TABLE public.venue_ratings_by_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  rating integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.venue_ratings_by_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can manage venue ratings" ON public.venue_ratings_by_admin FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Blocked users
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blocked_by uuid NOT NULL,
  reason text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  unblocked_at timestamptz,
  status text NOT NULL DEFAULT 'active'
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can manage blocked users" ON public.blocked_users FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- User warnings
CREATE TABLE public.user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  warned_by uuid NOT NULL,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  acknowledged boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can manage warnings" ON public.user_warnings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

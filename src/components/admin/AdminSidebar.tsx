import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import {
  Home, Users, Star, Building2, CalendarCheck, AlertTriangle,
  ShieldBan, BarChart3, ToggleLeft, List, Settings, Music, LogOut, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { label: "Dashboard Overview", path: "/admin/dashboard", icon: Home },
  { label: "User Management", path: "/admin/users", icon: Users, badgeKey: "verifications" as const },
  { label: "Artist Reviews", path: "/admin/artist-reviews", icon: Star },
  { label: "Venue Reviews", path: "/admin/venue-reviews", icon: Building2 },
  { label: "Bookings Overview", path: "/admin/bookings", icon: CalendarCheck },
  { label: "Disputes", path: "/admin/disputes", icon: AlertTriangle, badgeKey: "disputes" as const },
  { label: "Block & Warnings", path: "/admin/blocked-users", icon: ShieldBan, badgeKey: "appeals" as const },
  { label: "Platform Analytics", path: "/admin/analytics", icon: BarChart3 },
  { label: "Feature Flags", path: "/admin/feature-flags", icon: ToggleLeft },
  { label: "Audit Log", path: "/admin/audit-log", icon: List },
  { label: "Settings", path: "/admin/settings", icon: Settings },
];

type BadgeCounts = { verifications: number; disputes: number; appeals: number };

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("Super Admin");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [badges, setBadges] = useState<BadgeCounts>({ verifications: 0, disputes: 0, appeals: 0 });

  const loadBadges = useCallback(async () => {
    const [{ count: vCount }, { count: dCount }, { count: aCount }] = await Promise.all([
      supabase.from("verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open", "under_review"]),
      supabase.from("blocked_users").select("id", { count: "exact", head: true }).eq("appeal_status", "pending"),
    ]);
    setBadges({ verifications: vCount || 0, disputes: dCount || 0, appeals: aCount || 0 });
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: admin } = await supabase.from("admin_users").select("display_name").eq("user_id", session.user.id).maybeSingle();
      if (admin?.display_name) setAdminName(admin.display_name);
      const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", session.user.id).maybeSingle();
      if (profile?.full_name && !admin?.display_name) setAdminName(profile.full_name);
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    };
    load();
    loadBadges();
    const interval = setInterval(loadBadges, 60000);
    return () => clearInterval(interval);
  }, [loadBadges]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <aside className="w-[260px] min-h-screen flex flex-col shrink-0" style={{ background: "#7C5CBF" }}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-2.5">
        <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
          <Music className="h-5 w-5 text-white" />
        </div>
        <div>
          <span className="text-base font-display font-bold text-white tracking-tight block leading-tight">GigZnation</span>
          <span className="text-[11px] text-white/60 font-medium">Admin Portal</span>
        </div>
      </div>

      {/* Admin Avatar */}
      <div className="px-5 pb-5 flex items-center gap-3 border-b border-white/10 mb-3">
        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-white" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{adminName}</p>
          <p className="text-[11px] text-white/50">Super Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, path, icon: Icon, badgeKey }) => {
          const isActive = location.pathname === path || (path !== "/admin/dashboard" && location.pathname.startsWith(path));
          const badgeCount = badgeKey ? badges[badgeKey] : 0;
          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all relative",
                isActive ? "bg-white text-[#7C5CBF] shadow-sm" : "text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#7C5CBF]" />}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badgeCount > 0 && (
                <span className={cn(
                  "text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
                  badgeKey === "disputes" ? "bg-red-500 text-white" : badgeKey === "appeals" ? "bg-orange-400 text-white" : "bg-accent text-white"
                )}>
                  {badgeCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-white/10">
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors w-full">
          <LogOut className="h-4 w-4 shrink-0" />Sign Out
        </button>
      </div>
      <div className="px-5 pb-4 text-[10px] text-white/30">© 2026 GigZnation</div>
    </aside>
  );
};

export default AdminSidebar;

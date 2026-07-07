import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CalendarCheck, CreditCard, MessageSquare, Star, FileText, ArrowLeftRight, XCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { isToday, isThisWeek, formatDistanceToNowStrict } from "date-fns";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  data: any;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
  booking_request: { icon: CalendarCheck, color: "bg-primary/10 text-primary" },
  booking_confirmed: { icon: CalendarCheck, color: "bg-success/10 text-success" },
  booking_cancelled: { icon: XCircle, color: "bg-destructive/10 text-destructive" },
  payment: { icon: CreditCard, color: "bg-accent/10 text-accent" },
  message: { icon: MessageSquare, color: "bg-[hsl(174,95%,32%)]/10 text-[hsl(174,95%,32%)]" },
  review: { icon: Star, color: "bg-success/10 text-success" },
  application: { icon: FileText, color: "bg-primary/10 text-primary" },
  counter_offer: { icon: ArrowLeftRight, color: "bg-primary/10 text-primary" },
  general: { icon: Bell, color: "bg-primary/10 text-primary" },
};

function getRoute(n: Notif, role: string): string {
  const d = n.data as any;
  const bookingId = d?.booking_id || d?.bookingId;
  switch (n.type) {
    case "booking_request": return role === "artist" ? `/booking/${bookingId}` : `/venue-booking/${bookingId}`;
    case "booking_confirmed": return role === "artist" ? `/booking/${bookingId}` : `/venue-booking/${bookingId}`;
    case "booking_cancelled": return "/bookings";
    case "payment": return "/bookings";
    case "message": return `/chat/${bookingId}`;
    case "review": return `/review/${bookingId}`;
    case "application": return "/bookings";
    case "counter_offer": return role === "artist" ? `/booking/${bookingId}` : `/venue-booking/${bookingId}`;
    default: return "/";
  }
}

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("artist");
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (uid?: string) => {
    const id = uid || userId;
    if (!id) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    setNotifications((data as Notif[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (roles?.[0]) setRole(roles[0].role);
      load(user.id);
    };
    init();
  }, [load]);

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleTap = async (n: Notif) => {
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
    navigate(getRoute(n, role));
  };

  // Pull to refresh
  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Group
  const today: Notif[] = [];
  const thisWeek: Notif[] = [];
  const earlier: Notif[] = [];
  notifications.forEach((n) => {
    const d = new Date(n.created_at);
    if (isToday(d)) today.push(n);
    else if (isThisWeek(d)) thisWeek.push(n);
    else earlier.push(n);
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderGroup = (label: string, items: Notif[]) => {
    if (!items.length) return null;
    return (
      <div key={label}>
        <p className="px-5 pt-4 pb-2 font-display font-semibold text-[13px] text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <div className="divide-y divide-card-border">
          {items.map((n) => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.general;
            const Icon = cfg.icon;
            const timeAgo = (() => {
              try { return formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true }); }
              catch { return ""; }
            })();

            return (
              <button
                key={n.id}
                onClick={() => handleTap(n)}
                className={cn(
                  "w-full px-5 py-3 flex items-start gap-3 text-left transition",
                  !n.read ? "bg-[hsl(263,60%,95%)]" : "bg-card"
                )}
              >
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", cfg.color)}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-body text-sm text-foreground leading-snug",
                    !n.read ? "font-bold" : "font-normal"
                  )}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="font-body text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>
                  )}
                  <p className="font-body text-[11px] text-muted-foreground mt-1">{timeAgo}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="px-5 pt-6 pb-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="font-body text-xs font-semibold text-primary"
          >
            Mark all as read
          </button>
        )}
      </header>

      {/* Pull to refresh hint */}
      {refreshing && (
        <div className="flex justify-center py-2">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center px-5 py-20 text-center space-y-4">
          {/* Spotlight SVG */}
          <svg width="120" height="100" viewBox="0 0 120 100" fill="none" className="mb-2">
            {/* Stage */}
            <rect x="10" y="75" width="100" height="8" rx="4" fill="hsl(var(--muted))" />
            <rect x="25" y="70" width="70" height="5" rx="2.5" fill="hsl(var(--muted))" opacity="0.6" />
            {/* Spotlight beam */}
            <path d="M60 10 L30 70 L90 70 Z" fill="hsl(var(--primary))" opacity="0.08" />
            {/* Spotlight fixture */}
            <circle cx="60" cy="10" r="8" fill="hsl(var(--primary))" opacity="0.2" />
            <circle cx="60" cy="10" r="4" fill="hsl(var(--primary))" opacity="0.4" />
            {/* Star sparkles */}
            <path d="M35 30 L37 35 L42 37 L37 39 L35 44 L33 39 L28 37 L33 35Z" fill="hsl(var(--primary))" opacity="0.15" />
            <path d="M85 25 L86 28 L89 29 L86 30 L85 33 L84 30 L81 29 L84 28Z" fill="hsl(var(--accent))" opacity="0.2" />
          </svg>
          <h2 className="font-display font-semibold text-base text-foreground">You're all caught up!</h2>
          <p className="font-body text-sm text-muted-foreground">No new notifications</p>
        </div>
      )}

      {/* Notification groups */}
      {!loading && (
        <div
          onTouchEnd={handleRefresh}
        >
          {renderGroup("Today", today)}
          {renderGroup("This Week", thisWeek)}
          {renderGroup("Earlier", earlier)}
        </div>
      )}
    </div>
  );
};

export default Notifications;

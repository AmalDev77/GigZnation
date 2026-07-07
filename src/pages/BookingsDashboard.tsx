import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Star, MessageSquare, Eye, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, differenceInHours } from "date-fns";

type Tab = "pending" | "confirmed" | "completed" | "cancelled";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_MAP: Record<Tab, string[]> = {
  pending: ["pending", "counter_offer"],
  confirmed: ["confirmed", "paid"],
  completed: ["completed"],
  cancelled: ["cancelled", "declined"],
};

/* ─── Swipeable Card ─── */
const SwipeCard = ({
  children,
  onMessage,
  onView,
}: {
  children: React.ReactNode;
  onMessage: () => void;
  onView: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offset, setOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    currentX.current = e.touches[0].clientX;
    const diff = Math.min(0, currentX.current - startX.current);
    setOffset(Math.max(diff, -140));
  };
  const handleTouchEnd = () => {
    setOffset(offset < -60 ? -140 : 0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Actions behind */}
      <div className="absolute right-0 top-0 bottom-0 flex">
        <button
          onClick={onMessage}
          className="w-[70px] bg-primary flex flex-col items-center justify-center gap-1 text-primary-foreground"
        >
          <MessageSquare size={18} />
          <span className="text-[10px] font-medium">Message</span>
        </button>
        <button
          onClick={onView}
          className="w-[70px] bg-accent flex flex-col items-center justify-center gap-1 text-accent-foreground"
        >
          <Eye size={18} />
          <span className="text-[10px] font-medium">Details</span>
        </button>
      </div>
      {/* Card content */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-card border border-card-border rounded-xl transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
};

/* ─── Countdown ─── */
const Countdown = ({ date, time }: { date: string; time?: string }) => {
  const eventDate = new Date(`${date}T${time || "00:00"}:00`);
  const now = new Date();
  if (eventDate <= now) return null;
  const days = differenceInDays(eventDate, now);
  const hours = differenceInHours(eventDate, now) % 24;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[hsl(174,95%,32%)]">
      <Clock size={11} /> In {days}d {hours}h
    </span>
  );
};

/* ─── Main Component ─── */
const BookingsDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [role, setRole] = useState<"artist" | "venue" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [otherParties, setOtherParties] = useState<Record<string, any>>({});
  const [reviews, setReviews] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load user, role, profile
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", session.user.id);
      const r = roles?.[0]?.role as "artist" | "venue" | undefined;
      if (!r) return;
      setRole(r);

      if (r === "artist") {
        const { data } = await supabase.from("artist_profiles").select("id").eq("user_id", session.user.id).maybeSingle();
        if (data) setProfileId(data.id);
      } else {
        const { data } = await supabase.from("venue_profiles").select("id").eq("user_id", session.user.id).maybeSingle();
        if (data) setProfileId(data.id);
      }
    };
    init();
  }, []);

  // Load bookings when profileId or tab changes
  useEffect(() => {
    if (!profileId || !role) return;
    const load = async () => {
      setLoading(true);
      const col = role === "artist" ? "artist_id" : "venue_id";
      const statuses = STATUS_MAP[activeTab];

      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq(col, profileId)
        .in("status", statuses)
        .order("date", { ascending: activeTab === "confirmed" });

      setBookings(data || []);

      // Fetch other parties
      if (data?.length) {
        const otherCol = role === "artist" ? "venue_id" : "artist_id";
        const ids = [...new Set(data.map((b: any) => b[otherCol]))];
        const table = role === "artist" ? "venue_profiles" : "artist_profiles";
        const { data: parties } = await supabase
          .from(table)
          .select("*")
          .in("id", ids);

        const map: Record<string, any> = {};
        parties?.forEach((p: any) => { map[p.id] = p; });
        setOtherParties(map);

        // Check reviews for completed
        if (activeTab === "completed") {
          const bookingIds = data.map((b: any) => b.id);
          const { data: revs } = await supabase
            .from("reviews")
            .select("booking_id")
            .in("booking_id", bookingIds);
          setReviews(new Set(revs?.map((r: any) => r.booking_id)));
        }
      }
      setLoading(false);
    };
    load();
  }, [profileId, role, activeTab]);

  const pendingCount = bookings.length; // only accurate for pending tab, computed below
  const [allPendingCount, setAllPendingCount] = useState(0);
  useEffect(() => {
    if (!profileId || !role) return;
    const col = role === "artist" ? "artist_id" : "venue_id";
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq(col, profileId)
      .in("status", STATUS_MAP.pending)
      .then(({ count }) => setAllPendingCount(count ?? 0));
  }, [profileId, role, bookings]);

  const getDetailRoute = useCallback((b: any) => {
    return role === "artist" ? `/booking/${b.id}` : `/venue-booking/${b.id}`;
  }, [role]);

  const totalEarned = activeTab === "completed" && role === "artist"
    ? bookings.reduce((sum, b) => sum + (b.amount ?? 0), 0)
    : 0;

  return (
    <div className="animate-fade-in pb-4">
      {/* Header */}
      <header className="px-5 pt-6 pb-3">
        <h1 className="font-display font-bold text-2xl text-foreground">My Bookings</h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-card-border px-5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 pb-2.5 text-center font-body text-sm font-medium transition relative",
              activeTab === tab.key
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            {tab.label}
            {tab.key === "pending" && allPendingCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                {allPendingCount}
              </span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4 space-y-3">
        {/* Earnings summary for completed artist */}
        {activeTab === "completed" && role === "artist" && bookings.length > 0 && (
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-center">
            <p className="font-body text-xs text-muted-foreground">Total Earned</p>
            <p className="font-display font-bold text-2xl text-primary mt-0.5">
              ₹{totalEarned.toLocaleString("en-IN")}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && bookings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Calendar size={24} className="text-muted-foreground" />
            </div>
            <p className="font-display font-semibold text-sm text-foreground">
              No {activeTab} bookings
            </p>
            <p className="font-body text-xs text-muted-foreground max-w-[200px]">
              {activeTab === "pending" ? "You're all caught up!" : `Your ${activeTab} bookings will appear here.`}
            </p>
          </div>
        )}

        {/* Booking cards */}
        {!loading && bookings.map((b) => {
          const otherId = role === "artist" ? b.venue_id : b.artist_id;
          const other = otherParties[otherId];
          const otherName = role === "artist"
            ? other?.venue_name || "Venue"
            : other?.stage_name || "Artist";
          const otherPhoto = role === "artist"
            ? other?.logo_url || other?.cover_photo_url
            : other?.cover_photo_url;
          const genre = role === "venue" ? other?.genre?.split(",")[0] : other?.venue_type;
          const eventType = b.notes?.split("|")[0]?.trim();
          const cancelReason = activeTab === "cancelled"
            ? b.notes?.match(/Declined: (.+)/)?.[1] || null
            : null;

          const statusChip: Record<string, { label: string; cls: string }> = {
            pending: { label: "Pending", cls: "bg-accent/10 text-accent" },
            counter_offer: { label: "Counter", cls: "bg-primary/10 text-primary" },
            confirmed: { label: "Confirmed", cls: "bg-success/10 text-success" },
            paid: { label: "Paid", cls: "bg-success/10 text-success" },
            completed: { label: "Completed", cls: "bg-muted text-foreground" },
            cancelled: { label: "Cancelled", cls: "bg-destructive/10 text-destructive" },
            declined: { label: "Declined", cls: "bg-destructive/10 text-destructive" },
          };
          const chip = statusChip[b.status] ?? statusChip.pending;

          return (
            <SwipeCard
              key={b.id}
              onMessage={() => navigate("/messages")}
              onView={() => navigate(getDetailRoute(b))}
            >
              <button
                onClick={() => navigate(getDetailRoute(b))}
                className="w-full p-3 flex items-start gap-3 text-left"
              >
                {/* Photo */}
                <div className="h-[52px] w-[52px] rounded-full shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center">
                  {otherPhoto ? (
                    <img src={otherPhoto} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display font-bold text-primary text-lg">
                      {otherName[0]?.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-semibold text-[15px] text-foreground truncate">
                      {otherName}
                    </p>
                    <span className="font-display font-bold text-sm text-accent whitespace-nowrap">
                      ₹{(b.amount ?? 0).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {b.date && (
                      <span className="font-body text-xs text-muted-foreground">
                        {format(new Date(b.date + "T00:00:00"), "MMM d")}
                      </span>
                    )}
                    {b.start_time && (
                      <span className="font-body text-xs text-muted-foreground">
                        · {b.start_time.slice(0, 5)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", chip.cls)}>
                      {chip.label}
                    </span>
                    {genre && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                        {genre}
                      </span>
                    )}
                  </div>

                  {/* Countdown for confirmed */}
                  {activeTab === "confirmed" && b.date && (
                    <div className="mt-1.5">
                      <Countdown date={b.date} time={b.start_time} />
                    </div>
                  )}

                  {/* Cancel reason */}
                  {cancelReason && (
                    <p className="mt-1 font-body text-[11px] text-muted-foreground italic">
                      Reason: {cancelReason}
                    </p>
                  )}
                </div>
              </button>

              {/* Leave review for completed */}
              {activeTab === "completed" && !reviews.has(b.id) && (
                <div className="px-3 pb-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/review/${b.id}`); }}
                    className="w-full h-9 rounded-btn bg-accent text-accent-foreground font-display font-bold text-xs hover:opacity-90 transition flex items-center justify-center gap-1.5"
                  >
                    <Star size={13} /> Leave a Review
                  </button>
                </div>
              )}
            </SwipeCard>
          );
        })}
      </div>
    </div>
  );
};

export default BookingsDashboard;

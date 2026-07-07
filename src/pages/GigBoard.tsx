import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MapPin, Clock, Check } from "lucide-react";
import { format, formatDistanceToNow, isAfter, nextFriday, nextSunday, addWeeks, startOfWeek, endOfWeek, isFriday, isSunday } from "date-fns";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

/* ── Types ── */
interface GigItem {
  id: string;
  title: string;
  genre: string | null;
  city: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  budget: number | null;
  status: string;
  created_at: string;
  venue_id: string;
  venue_name: string | null;
  venue_logo: string | null;
}

const FILTERS = ["All", "This Weekend", "Next Week", "By Genre"];

const GigBoard = () => {
  const navigate = useNavigate();
  const [gigs, setGigs] = useState<GigItem[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [artistProfileId, setArtistProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [applyTarget, setApplyTarget] = useState<GigItem | null>(null);
  const [applying, setApplying] = useState(false);

  /* ── Init: load artist profile + gigs + existing applications ── */
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Artist profile id
      const { data: ap } = await supabase
        .from("artist_profiles")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (ap) setArtistProfileId(ap.id);

      // Gigs (exclude expired)
      const { data: gigRows } = await supabase
        .from("gig_posts")
        .select("id, title, genre, city, date, start_time, end_time, budget, status, created_at, venue_id")
        .eq("status", "open")
        .gte("date", format(new Date(), "yyyy-MM-dd"))
        .order("date", { ascending: true });

      if (gigRows?.length) {
        const venueIds = [...new Set(gigRows.map(g => g.venue_id))];
        const { data: venues } = await supabase
          .from("venue_profiles")
          .select("id, venue_name, logo_url")
          .in("id", venueIds);
        const vm = new Map(venues?.map(v => [v.id, v]) || []);

        setGigs(gigRows.map(g => ({
          ...g,
          venue_name: vm.get(g.venue_id)?.venue_name || null,
          venue_logo: vm.get(g.venue_id)?.logo_url || null,
        })));
      }

      // Existing applications
      if (ap) {
        const { data: apps } = await supabase
          .from("applications")
          .select("gig_id")
          .eq("artist_id", ap.id);
        if (apps) setAppliedIds(new Set(apps.map(a => a.gig_id)));
      }

      setLoading(false);
    };
    init();
  }, []);

  /* ── Apply ── */
  const handleApply = async () => {
    if (!applyTarget || !artistProfileId) return;
    setApplying(true);

    const { error } = await supabase
      .from("applications")
      .insert({ gig_id: applyTarget.id, artist_id: artistProfileId, status: "pending" });

    setApplying(false);
    setApplyTarget(null);

    if (error) {
      if (error.code === "23505") {
        toast.info("You've already applied to this gig");
      } else {
        toast.error("Failed to apply");
        console.error(error);
      }
      return;
    }

    setAppliedIds(prev => new Set(prev).add(applyTarget.id));
    toast.success("Application sent! 🎉");
    // Haptic simulation
    if (navigator.vibrate) navigator.vibrate(50);
  };

  /* ── Filter logic ── */
  const filteredGigs = gigs.filter(g => {
    if (!g.date) return activeFilter === "All";
    const d = new Date(g.date);
    const today = new Date();

    if (activeFilter === "This Weekend") {
      const fri = isFriday(today) ? today : nextFriday(today);
      const sun = isSunday(today) ? today : nextSunday(today);
      return d >= fri && d <= sun;
    }
    if (activeFilter === "Next Week") {
      const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      return d >= nextWeekStart && d <= nextWeekEnd;
    }
    return true;
  });

  const fmtTime = (t: string | null) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hr = parseInt(h, 10);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  };

  const getDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return null;
    const hrs = Math.floor(mins / 60);
    const rm = mins % 60;
    return hrs > 0 ? `${hrs}h${rm > 0 ? ` ${rm}m` : ""}` : `${rm}m`;
  };

  return (
    <div className="animate-fade-in min-h-screen bg-background">
      {/* Header */}
      <div className="px-5 pt-6 pb-2">
        <h1 className="font-display font-bold text-2xl text-foreground">Gig Board</h1>
        <p className="font-body text-sm text-muted-foreground">Open opportunities near you</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto px-5 py-3 scrollbar-hide">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              "shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition",
              activeFilter === f
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-card-border text-foreground hover:border-primary/30"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Gig list */}
      <div className="px-5 pb-6 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="space-y-1 flex-1">
                  <div className="h-4 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              </div>
              <div className="h-6 w-24 rounded-full bg-muted" />
              <div className="h-5 w-32 rounded bg-muted" />
              <div className="h-10 w-full rounded-btn bg-muted" />
            </div>
          ))
        ) : filteredGigs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="text-5xl">📋</div>
            <p className="font-display font-bold text-foreground">No gigs found</p>
            <p className="font-body text-sm text-muted-foreground text-center max-w-[220px]">
              Try a different filter or check back later
            </p>
          </div>
        ) : (
          filteredGigs.map(gig => {
            const applied = appliedIds.has(gig.id);
            return (
              <div key={gig.id} className="rounded-xl border border-card-border bg-card p-4 space-y-3">
                {/* Row 1: venue info */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-info/10 flex items-center justify-center overflow-hidden">
                    {gig.venue_logo ? (
                      <img src={gig.venue_logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-display font-bold text-info">
                        {(gig.venue_name || "V")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[15px] text-foreground truncate">
                      {gig.venue_name || "Venue"}
                    </p>
                    <div className="flex items-center gap-2">
                      {gig.city && (
                        <span className="text-[12px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin size={10} /> {gig.city}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(gig.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 2: event details */}
                <div className="flex items-center gap-2 flex-wrap">
                  {gig.genre && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE9FF] text-primary">
                      {gig.genre}
                    </span>
                  )}
                  {gig.date && (
                    <span className="font-body text-sm text-foreground">
                      {format(new Date(gig.date), "EEE, dd MMM")}
                    </span>
                  )}
                  {gig.start_time && (
                    <span className="font-body text-sm text-foreground flex items-center gap-1">
                      <Clock size={12} className="text-muted-foreground" />
                      {fmtTime(gig.start_time)}
                      {gig.end_time && ` – ${fmtTime(gig.end_time)}`}
                    </span>
                  )}
                  {getDuration(gig.start_time, gig.end_time) && (
                    <span className="text-[11px] text-muted-foreground">
                      ({getDuration(gig.start_time, gig.end_time)})
                    </span>
                  )}
                </div>

                {/* Row 3: genre needed */}
                {gig.genre && (
                  <div>
                    <span className="font-body text-[11px] text-muted-foreground">Genre Needed</span>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {gig.genre.split(",").map(g => (
                        <span key={g.trim()} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE9FF] text-primary">
                          {g.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Row 4: budget */}
                {gig.budget !== null && (
                  <p className="font-display font-bold text-lg text-accent">
                    ₹{gig.budget.toLocaleString("en-IN")}
                  </p>
                )}

                {/* Apply button */}
                <button
                  onClick={() => !applied && setApplyTarget(gig)}
                  disabled={applied}
                  className={cn(
                    "w-full h-10 rounded-btn font-body text-sm font-semibold transition",
                    applied
                      ? "bg-muted text-muted-foreground cursor-default flex items-center justify-center gap-1.5"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  )}
                >
                  {applied ? (
                    <><Check size={14} /> Applied</>
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Apply Confirmation Bottom Sheet ── */}
      <Drawer open={!!applyTarget} onOpenChange={(open) => !open && setApplyTarget(null)}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle className="font-display text-lg">
              Send your profile to {applyTarget?.venue_name || "this venue"}?
            </DrawerTitle>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Your artist profile, portfolio and availability will be shared.
            </p>
          </DrawerHeader>
          <DrawerFooter className="flex flex-col gap-2">
            <button
              onClick={handleApply}
              disabled={applying}
              className="w-full h-12 rounded-btn bg-accent text-accent-foreground font-display font-bold text-sm hover:opacity-90 transition"
            >
              {applying ? "Sending…" : "Confirm Application"}
            </button>
            <DrawerClose asChild>
              <button className="w-full h-10 text-sm font-medium text-muted-foreground hover:text-foreground transition">
                Cancel
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default GigBoard;

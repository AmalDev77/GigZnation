import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, MessageCircle, X, MapPin, Star } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import VenueHomeFeed from "@/components/home/VenueHomeFeed";

/* ── Types ── */
interface GigCard {
  type: "gig";
  id: string;
  title: string;
  venue_name: string | null;
  date: string | null;
  start_time: string | null;
  genre: string | null;
  budget: number | null;
  city: string | null;
}

interface ArtistCard {
  type: "artist";
  id: string;
  stage_name: string | null;
  genre: string | null;
  city: string | null;
  rating: number | null;
}

type FeedItem = GigCard | ArtistCard;
const PAGE_SIZE = 10;

/* ── Skeleton ── */
const SkeletonCard = () => (
  <div className="rounded-xl border border-card-border bg-card p-4 space-y-3 animate-pulse">
    <div className="h-4 w-2/3 rounded bg-muted" />
    <div className="h-3 w-1/2 rounded bg-muted" />
    <div className="flex gap-2">
      <div className="h-6 w-16 rounded-full bg-muted" />
      <div className="h-6 w-20 rounded-full bg-muted" />
    </div>
    <div className="h-8 w-24 rounded-btn bg-muted" />
  </div>
);

const HomePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const pageRef = useRef(0);
  const observerRef = useRef<HTMLDivElement | null>(null);

  /* ── Init ── */
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const role = roles?.[0]?.role || null;
      setUserRole(role);

      if (role === "artist") {
        const { data: profile } = await supabase
          .from("artist_profiles")
          .select("city, genre")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (profile) setUserCity(profile.city);
      }

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("read", false);
      if (count) setUnreadCount(count);
    };
    init();
  }, []);

  /* ── Artist feed fetch ── */
  const fetchArtistFeed = useCallback(
    async (page: number, reset = false) => {
      const from = page * PAGE_SIZE;

      let gigsQuery = supabase
        .from("gig_posts")
        .select("id, title, genre, date, start_time, budget, city, venue_id")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (userCity) gigsQuery = gigsQuery.eq("city", userCity);
      const { data: gigs } = await gigsQuery;

      let gigCards: GigCard[] = [];
      if (gigs?.length) {
        const venueIds = [...new Set(gigs.map((g) => g.venue_id))];
        const { data: venues } = await supabase
          .from("venue_profiles")
          .select("id, venue_name")
          .in("id", venueIds);
        const venueMap = new Map(venues?.map((v) => [v.id, v.venue_name]) || []);
        gigCards = gigs.map((g) => ({
          type: "gig" as const,
          id: g.id, title: g.title, venue_name: venueMap.get(g.venue_id) || null,
          date: g.date, start_time: g.start_time, genre: g.genre, budget: g.budget, city: g.city,
        }));
      }

      let artistsQuery = supabase
        .from("artist_profiles")
        .select("id, stage_name, genre, city, rating")
        .order("rating", { ascending: false })
        .range(from, from + Math.floor(PAGE_SIZE / 2) - 1);
      if (userCity) artistsQuery = artistsQuery.eq("city", userCity);
      const { data: artists } = await artistsQuery;

      const artistCards: ArtistCard[] = (artists || []).map((a) => ({
        type: "artist" as const, id: a.id, stage_name: a.stage_name,
        genre: a.genre, city: a.city, rating: a.rating,
      }));

      const merged: FeedItem[] = [];
      let gi = 0, ai = 0;
      while (gi < gigCards.length || ai < artistCards.length) {
        if (gi < gigCards.length) merged.push(gigCards[gi++]);
        if (gi < gigCards.length) merged.push(gigCards[gi++]);
        if (ai < artistCards.length) merged.push(artistCards[ai++]);
      }
      if (merged.length < PAGE_SIZE) setHasMore(false);
      setFeed((prev) => (reset ? merged : [...prev, ...merged]));
      setLoading(false);
    },
    [userCity]
  );

  useEffect(() => {
    if (user && userRole === "artist") {
      pageRef.current = 0;
      fetchArtistFeed(0, true);
    }
    if (user && userRole === "venue") setLoading(false);
  }, [user, userRole, fetchArtistFeed]);

  /* Infinite scroll (artist only) */
  useEffect(() => {
    if (userRole !== "artist" || !observerRef.current || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loading) { pageRef.current += 1; fetchArtistFeed(pageRef.current); } },
      { threshold: 0.5 }
    );
    obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [userRole, hasMore, loading, fetchArtistFeed]);

  /* Real-time gig inserts (artist) */
  useEffect(() => {
    if (userRole !== "artist") return;
    const channel = supabase
      .channel("home-gigs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gig_posts" }, (payload) => {
        const g = payload.new as any;
        if (userCity && g.city !== userCity) return;
        setFeed((prev) => [{ type: "gig", id: g.id, title: g.title, venue_name: null, date: g.date, start_time: g.start_time, genre: g.genre, budget: g.budget, city: g.city } as GigCard, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userRole, userCity]);

  const userName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

  return (
    <div className="animate-fade-in">
      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-card-border px-5 py-3 flex items-center justify-between">
        <span className="font-display font-bold text-lg text-primary">GigZnation</span>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/messages")} className="relative">
            <MessageCircle size={20} className="text-foreground" />
          </button>
          <button className="relative" onClick={() => navigate("/notifications")}>
            <Bell size={20} className="text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Greeting ── */}
      <div className="px-5 pt-4 pb-2">
        <h1 className="font-display font-bold text-xl text-foreground">Hey, {userName}!</h1>
        <p className="font-body text-sm text-muted-foreground">
          {userRole === "venue" ? "Discover talent for your next event" : "Here's what's happening near you"}
        </p>
      </div>

      {/* ── Announcement ── */}
      {showAnnouncement && (
        <div className="mx-5 mb-4 relative rounded-xl overflow-hidden bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
          <button onClick={() => setShowAnnouncement(false)} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-xs">✕</span>
          </button>
          <p className="font-display font-bold text-sm">🎉 Welcome to GigZnation!</p>
          <p className="font-body text-xs mt-1 opacity-90">
            {userRole === "venue"
              ? "Post your first gig to start receiving artist applications."
              : "Complete your profile to get matched with top venues in your city."}
          </p>
        </div>
      )}

      {/* ── Role-specific feed ── */}
      {userRole === "venue" ? (
        <VenueHomeFeed />
      ) : (
        /* Artist feed */
        <div className="px-5 space-y-4 pb-4">
          {loading && feed.length === 0
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : feed.map((item) =>
                item.type === "gig" ? (
                  <GigOpportunityCard key={`gig-${item.id}`} gig={item} navigate={navigate} />
                ) : (
                  <ArtistNearbyCard key={`artist-${item.id}`} artist={item} navigate={navigate} />
                )
              )}
          {hasMore && <div ref={observerRef} className="h-8" />}
          {!hasMore && feed.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">You're all caught up!</p>
          )}
          {!loading && feed.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <p className="font-display font-bold text-foreground">No gigs near you yet</p>
              <p className="font-body text-sm text-muted-foreground">Check back soon or explore the Discover tab</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Gig Opportunity Card ── */
const GigOpportunityCard = ({ gig, navigate }: { gig: GigCard; navigate: ReturnType<typeof useNavigate> }) => {
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "TBD";
  const fmtTime = (t: string | null) => { if (!t) return ""; const [h, m] = t.split(":"); const hr = parseInt(h, 10); return ` · ${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; };

  return (
    <div className="rounded-xl border border-card-border bg-card p-4 space-y-2.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display font-semibold text-base text-foreground">{gig.venue_name || gig.title}</p>
          <p className="font-body text-[13px] text-muted-foreground">{fmtDate(gig.date)}{fmtTime(gig.start_time)}</p>
        </div>
        {gig.budget !== null && (
          <span className="font-display font-bold text-sm text-accent whitespace-nowrap">₹{gig.budget.toLocaleString("en-IN")}</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {gig.genre && <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE9FF] text-primary">{gig.genre}</span>}
        {gig.city && <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><MapPin size={11} /> {gig.city}</span>}
      </div>
      <button onClick={() => navigate(`/bookings?gig=${gig.id}`)} className="h-8 px-5 rounded-btn bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition">
        Apply
      </button>
    </div>
  );
};

/* ── Artist Nearby Card ── */
const ArtistNearbyCard = ({ artist, navigate }: { artist: ArtistCard; navigate: ReturnType<typeof useNavigate> }) => (
  <div className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-3">
    <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-lg font-display font-bold text-primary">
      {(artist.stage_name || "A")[0].toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-display font-semibold text-sm text-foreground truncate">{artist.stage_name || "Artist"}</p>
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        {artist.genre && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE9FF] text-primary">{artist.genre}</span>}
        {artist.city && <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><MapPin size={10} /> {artist.city}</span>}
        {artist.rating !== null && artist.rating > 0 && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
            <Star size={10} className="text-yellow-400 fill-yellow-400" /> {artist.rating.toFixed(1)}
          </span>
        )}
      </div>
    </div>
    <button onClick={() => navigate(`/artist/${artist.id}`)} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
      View Profile
    </button>
  </div>
);

export default HomePage;

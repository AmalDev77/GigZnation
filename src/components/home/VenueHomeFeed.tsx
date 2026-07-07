import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, nextFriday, nextSaturday, nextSunday, isFriday, isSaturday, isSunday, isToday } from "date-fns";

const GENRES = ["All", "Music", "Comedy", "Dance", "DJ", "Spoken Word", "Theatre", "Band"];

interface ArtistItem {
  id: string;
  stage_name: string | null;
  genre: string | null;
  city: string | null;
  rating: number | null;
  min_price: number | null;
  max_price: number | null;
  verified: boolean | null;
  created_at: string;
}

/* ── Skeleton ── */
const SkeletonCard = () => (
  <div className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-3 animate-pulse">
    <div className="h-16 w-16 rounded-full bg-muted shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
      <div className="h-3 w-1/3 rounded bg-muted" />
    </div>
    <div className="h-8 w-20 rounded-btn bg-muted" />
  </div>
);

/* ── Artist Card ── */
const ArtistCard = ({ artist, navigate }: { artist: ArtistItem; navigate: ReturnType<typeof useNavigate> }) => (
  <button
    onClick={() => navigate(`/artist/${artist.id}`)}
    className="w-full flex items-center gap-3 rounded-xl border border-card-border bg-card p-3 text-left transition hover:border-primary/30"
  >
    <div className="h-16 w-16 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xl font-display font-bold text-primary">
      {(artist.stage_name || "A")[0].toUpperCase()}
    </div>
    <div className="flex-1 min-w-0 space-y-1">
      <p className="font-display font-semibold text-[15px] text-foreground truncate">
        {artist.stage_name || "Artist"}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {artist.genre && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE9FF] text-primary">
            {artist.genre}
          </span>
        )}
        {artist.city && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
            <MapPin size={10} /> {artist.city}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {artist.rating !== null && artist.rating > 0 && (
          <span className="text-[11px] flex items-center gap-0.5 text-accent font-semibold">
            <Star size={11} className="text-accent fill-accent" /> {artist.rating.toFixed(1)}
          </span>
        )}
        {artist.min_price !== null && artist.max_price !== null && (
          <span className="font-display font-bold text-[12px] text-accent">
            ₹{artist.min_price.toLocaleString("en-IN")} – ₹{artist.max_price.toLocaleString("en-IN")}
          </span>
        )}
      </div>
    </div>
    <span className="shrink-0 h-8 px-3 rounded-btn border border-primary text-primary text-xs font-semibold flex items-center">
      View Profile
    </span>
  </button>
);

/* ── Section ── */
const FeedSection = ({
  title,
  artists,
  loading,
  navigate,
}: {
  title: string;
  artists: ArtistItem[];
  loading: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  if (!loading && artists.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-display font-semibold text-base text-foreground">{title}</h2>
      {loading
        ? Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)
        : artists.map((a) => <ArtistCard key={a.id} artist={a} navigate={navigate} />)}
    </section>
  );
};

/* ── Main Component ── */
const VenueHomeFeed = () => {
  const navigate = useNavigate();
  const [activeGenre, setActiveGenre] = useState("All");
  const [venueCity, setVenueCity] = useState<string | null>(null);
  const [venueGenre, setVenueGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [availableThisWeekend, setAvailableThisWeekend] = useState<ArtistItem[]>([]);
  const [newArtists, setNewArtists] = useState<ArtistItem[]>([]);
  const [recommended, setRecommended] = useState<ArtistItem[]>([]);
  const [recentlyReviewed, setRecentlyReviewed] = useState<ArtistItem[]>([]);

  /* get venue info */
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: vp } = await supabase
        .from("venue_profiles")
        .select("city, venue_type")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (vp) {
        setVenueCity(vp.city);
        setVenueGenre(vp.venue_type);
      }
    };
    init();
  }, []);

  /* fetch sections */
  const fetchSections = useCallback(async () => {
    setLoading(true);
    const genreFilter = activeGenre !== "All" ? activeGenre : null;

    /* weekend dates */
    const today = new Date();
    const fri = isFriday(today) ? today : nextFriday(today);
    const sat = isSaturday(today) ? today : nextSaturday(today);
    const sun = isSunday(today) ? today : nextSunday(today);
    const weekendDates = [format(fri, "yyyy-MM-dd"), format(sat, "yyyy-MM-dd"), format(sun, "yyyy-MM-dd")];

    /* 1. Available this weekend */
    let q1 = supabase.from("artist_profiles").select("*").order("rating", { ascending: false }).limit(10);
    if (venueCity) q1 = q1.eq("city", venueCity);
    if (genreFilter) q1 = q1.ilike("genre", `%${genreFilter}%`);
    const { data: allArtists } = await q1;

    const weekendAvailable = (allArtists || []).filter((a) => {
      if (!a.availability || typeof a.availability !== "object") return false;
      const avail = a.availability as Record<string, string>;
      return weekendDates.some((d) => avail[d] === "available");
    });
    setAvailableThisWeekend(weekendAvailable.slice(0, 6) as ArtistItem[]);

    /* 2. New on GigZnation */
    let q2 = supabase.from("artist_profiles").select("*").eq("verified", true).order("created_at", { ascending: false }).limit(6);
    if (venueCity) q2 = q2.eq("city", venueCity);
    if (genreFilter) q2 = q2.ilike("genre", `%${genreFilter}%`);
    const { data: newData } = await q2;
    setNewArtists((newData || []) as ArtistItem[]);

    /* 3. Recommended (genre match) */
    let q3 = supabase.from("artist_profiles").select("*").order("rating", { ascending: false }).limit(6);
    if (venueCity) q3 = q3.eq("city", venueCity);
    if (genreFilter) {
      q3 = q3.ilike("genre", `%${genreFilter}%`);
    } else if (venueGenre) {
      q3 = q3.ilike("genre", `%${venueGenre}%`);
    }
    const { data: recData } = await q3;
    setRecommended((recData || []) as ArtistItem[]);

    /* 4. Recently reviewed (top rated as proxy) */
    let q4 = supabase.from("artist_profiles").select("*").gte("rating", 4).order("updated_at", { ascending: false }).limit(6);
    if (venueCity) q4 = q4.eq("city", venueCity);
    if (genreFilter) q4 = q4.ilike("genre", `%${genreFilter}%`);
    const { data: revData } = await q4;
    setRecentlyReviewed((revData || []) as ArtistItem[]);

    setLoading(false);
  }, [activeGenre, venueCity, venueGenre]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  return (
    <>
      {/* ── Genre filter bar ── */}
      <div className="sticky top-[53px] z-10 bg-background/90 backdrop-blur border-b border-card-border">
        <div className="flex gap-2 overflow-x-auto px-5 py-2.5 scrollbar-hide">
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={cn(
                "shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition",
                activeGenre === g
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-card-border text-foreground hover:border-primary/30"
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feed sections ── */}
      <div className="px-5 pt-4 space-y-6 pb-4">
        <FeedSection title="Available This Weekend" artists={availableThisWeekend} loading={loading} navigate={navigate} />
        <FeedSection title="New on GigZnation" artists={newArtists} loading={loading} navigate={navigate} />
        <FeedSection title="Recommended for You" artists={recommended} loading={loading} navigate={navigate} />
        <FeedSection title="Recently Reviewed" artists={recentlyReviewed} loading={loading} navigate={navigate} />

        {!loading &&
          availableThisWeekend.length === 0 &&
          newArtists.length === 0 &&
          recommended.length === 0 &&
          recentlyReviewed.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <p className="font-display font-bold text-foreground">No artists found</p>
              <p className="font-body text-sm text-muted-foreground">Try a different genre or check back later</p>
            </div>
          )}
      </div>
    </>
  );
};

export default VenueHomeFeed;

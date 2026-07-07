import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, MapPin, Star, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ── Constants ── */
const GENRES = [
  { label: "Music", emoji: "🎵" },
  { label: "Comedy", emoji: "😂" },
  { label: "Dance", emoji: "💃" },
  { label: "Spoken Word", emoji: "🎙️" },
  { label: "DJ", emoji: "🎧" },
  { label: "Theatre", emoji: "🎭" },
  { label: "Band", emoji: "🎸" },
  { label: "Visual", emoji: "🎨" },
];

const SORT_OPTIONS = [
  { value: "relevant", label: "Most Relevant" },
  { value: "newest", label: "Newest" },
  { value: "top_rated", label: "Top Rated" },
  { value: "price_low", label: "Price Low → High" },
  { value: "most_booked", label: "Most Booked" },
];

const CITIES = ["All Cities", "Mumbai", "Delhi", "Bangalore", "Pune", "Hyderabad", "Chennai", "Kolkata", "Jaipur", "Goa"];
const PRICE_RANGES = ["Any Price", "Under ₹5,000", "₹5,000–₹10,000", "₹10,000–₹20,000", "Above ₹20,000"];
const RATINGS = ["Any Rating", "4+ Stars", "3+ Stars"];

interface ArtistResult {
  id: string;
  stage_name: string | null;
  genre: string | null;
  city: string | null;
  rating: number | null;
  min_price: number | null;
  max_price: number | null;
  total_gigs: number | null;
  created_at: string;
}

/* ── Skeleton ── */
const SkeletonCard = () => (
  <div className="rounded-xl border border-card-border bg-card overflow-hidden animate-pulse">
    <div className="aspect-[4/3] bg-muted" />
    <div className="p-3 space-y-2">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
    </div>
  </div>
);

const Discover = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("relevant");
  const [cityFilter, setCityFilter] = useState("All Cities");
  const [priceFilter, setPriceFilter] = useState("Any Price");
  const [ratingFilter, setRatingFilter] = useState("Any Rating");
  const [results, setResults] = useState<ArtistResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Fetch ── */
  const fetchResults = useCallback(async () => {
    setLoading(true);

    let q = supabase
      .from("artist_profiles")
      .select("id, stage_name, genre, city, rating, min_price, max_price, total_gigs, created_at", { count: "exact" });

    if (query.trim()) {
      const s = `%${query.trim()}%`;
      q = q.or(`stage_name.ilike.${s},genre.ilike.${s},city.ilike.${s}`);
    }

    if (activeGenre) q = q.ilike("genre", `%${activeGenre}%`);
    if (cityFilter !== "All Cities") q = q.eq("city", cityFilter);

    if (priceFilter === "Under ₹5,000") q = q.lte("min_price", 5000);
    else if (priceFilter === "₹5,000–₹10,000") q = q.gte("min_price", 5000).lte("max_price", 10000);
    else if (priceFilter === "₹10,000–₹20,000") q = q.gte("min_price", 10000).lte("max_price", 20000);
    else if (priceFilter === "Above ₹20,000") q = q.gte("min_price", 20000);

    if (ratingFilter === "4+ Stars") q = q.gte("rating", 4);
    else if (ratingFilter === "3+ Stars") q = q.gte("rating", 3);

    if (sortBy === "newest") q = q.order("created_at", { ascending: false });
    else if (sortBy === "top_rated") q = q.order("rating", { ascending: false });
    else if (sortBy === "price_low") q = q.order("min_price", { ascending: true });
    else if (sortBy === "most_booked") q = q.order("total_gigs", { ascending: false });
    else q = q.order("rating", { ascending: false });

    q = q.limit(50);

    const { data, count } = await q;
    setResults((data || []) as ArtistResult[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [query, activeGenre, sortBy, cityFilter, priceFilter, ratingFilter]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchResults]);

  const handleGenre = (genre: string) => {
    setActiveGenre((prev) => (prev === genre ? null : genre));
  };

  return (
    <div className="animate-fade-in min-h-screen bg-background">
      {/* ── Search bar ── */}
      <div className="px-5 pt-5 pb-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists, genres, cities..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-card-border bg-card font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* ── Genre bubbles ── */}
      <div className="flex gap-3 overflow-x-auto px-5 pb-4 scrollbar-hide">
        {GENRES.map(({ label, emoji }) => {
          const isActive = activeGenre === label;
          return (
            <button
              key={label}
              onClick={() => handleGenre(label)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div
                className={cn(
                  "h-[72px] w-[72px] rounded-full flex items-center justify-center text-2xl transition",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-card-border"
                )}
              >
                {emoji}
              </div>
              <span
                className={cn(
                  "font-body text-[11px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Filter row ── */}
      <div className="px-5 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] rounded-full text-xs border-card-border bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={priceFilter} onValueChange={setPriceFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] rounded-full text-xs border-card-border bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRICE_RANGES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[90px] rounded-full text-xs border-card-border bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATINGS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] rounded-full text-xs border-card-border bg-card">
            <SlidersHorizontal size={12} className="mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── Result count ── */}
      {!loading && (
        <div className="px-5 pb-3">
          <p className="font-body text-xs text-muted-foreground">
            {totalCount} artist{totalCount !== 1 ? "s" : ""} found
          </p>
        </div>
      )}

      {/* ── Results grid ── */}
      <div className="px-5 pb-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="text-5xl">🔍</div>
            <p className="font-display font-bold text-foreground">No artists found</p>
            <p className="font-body text-sm text-muted-foreground text-center max-w-[220px]">
              Try removing a filter or searching for something else
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {results.map((artist) => (
              <button
                key={artist.id}
                onClick={() => navigate(`/artist/${artist.id}`)}
                className="rounded-xl border border-card-border bg-card overflow-hidden text-left transition hover:border-primary/30"
              >
                <div className="aspect-[4/3] bg-primary/10 flex items-center justify-center">
                  <span className="text-4xl font-display font-bold text-primary/30">
                    {(artist.stage_name || "A")[0].toUpperCase()}
                  </span>
                </div>

                <div className="p-3 space-y-1.5">
                  <p className="font-display font-semibold text-sm text-foreground truncate">
                    {artist.stage_name || "Artist"}
                  </p>

                  {artist.genre && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE9FF] text-primary">
                      {artist.genre}
                    </span>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {artist.city && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin size={10} /> {artist.city}
                      </span>
                    )}
                    {artist.rating !== null && artist.rating > 0 && (
                      <span className="text-[11px] text-accent font-semibold flex items-center gap-0.5">
                        <Star size={10} className="text-accent fill-accent" /> {artist.rating.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {artist.min_price !== null && artist.max_price !== null && (
                    <p className="font-display font-bold text-xs text-accent">
                      ₹{artist.min_price.toLocaleString("en-IN")} – ₹{artist.max_price.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Discover;

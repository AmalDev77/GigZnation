import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, BadgeCheck, MapPin, Users, Clock, Star,
  Volume2, Theater, Mic, Guitar, Monitor, DoorOpen, CarFront,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

/* ── amenity definitions ── */
const AMENITY_LIST = [
  { key: "sound_system", label: "Sound System", icon: Volume2 },
  { key: "stage", label: "Stage", icon: Theater },
  { key: "microphone", label: "Microphone", icon: Mic },
  { key: "backline", label: "Backline", icon: Guitar },
  { key: "projector", label: "Projector", icon: Monitor },
  { key: "green_room", label: "Green Room", icon: DoorOpen },
  { key: "parking", label: "Parking", icon: CarFront },
];

/* ── types ── */
interface VenueData {
  id: string;
  user_id: string;
  venue_name: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  capacity: number | null;
  venue_type: string | null;
  description: string | null;
  rating: number | null;
  verified: boolean | null;
  cover_photo_url: string | null;
  logo_url: string | null;
  operating_hours_start: string | null;
  operating_hours_end: string | null;
  amenities: Record<string, boolean>;
}

interface PastBooking {
  id: string;
  date: string;
  artist_id: string;
  artist_name: string | null;
  artist_genre: string | null;
}

interface GigPost {
  id: string;
  title: string;
  genre: string | null;
  date: string | null;
  budget: number | null;
  status: string;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

const REVIEW_CATEGORIES = ["Sound Quality", "Payment Timeliness", "Hospitality", "Overall"];

const VenuePublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<VenueData | null>(null);
  const [pastBookings, setPastBookings] = useState<PastBooking[]>([]);
  const [gigs, setGigs] = useState<GigPost[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [adminReview, setAdminReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      /* viewer role */
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        if (roles?.length) setViewerRole(roles[0].role);
      }

      /* venue profile */
      const { data, error } = await supabase
        .from("venue_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) { setLoading(false); return; }

      setVenue({
        ...data,
        amenities:
          data.amenities && typeof data.amenities === "object" && !Array.isArray(data.amenities)
            ? (data.amenities as Record<string, boolean>)
            : {},
      });

      /* past bookings */
      const { data: bookingRows } = await supabase
        .from("bookings")
        .select("id, date, artist_id")
        .eq("venue_id", id)
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(20);

      if (bookingRows?.length) {
        const artistIds = [...new Set(bookingRows.map((b) => b.artist_id))];
        const { data: artists } = await supabase
          .from("artist_profiles")
          .select("id, stage_name, genre")
          .in("id", artistIds);
        const artistMap = new Map(artists?.map((a) => [a.id, a]) || []);
        setPastBookings(
          bookingRows.map((b) => ({
            id: b.id,
            date: b.date,
            artist_id: b.artist_id,
            artist_name: artistMap.get(b.artist_id)?.stage_name || null,
            artist_genre: artistMap.get(b.artist_id)?.genre || null,
          }))
        );
      }

      /* gigs */
      const { data: gigRows } = await supabase
        .from("gig_posts")
        .select("id, title, genre, date, budget, status")
        .eq("venue_id", id)
        .order("date", { ascending: true })
        .limit(10);
      if (gigRows) setGigs(gigRows);

      /* reviews */
      const { data: bkIds } = await supabase
        .from("bookings")
        .select("id")
        .eq("venue_id", id);
      if (bkIds?.length) {
        const ids = bkIds.map((b) => b.id);
        const { data: revs, count } = await supabase
          .from("reviews")
          .select("*", { count: "exact" })
          .in("booking_id", ids)
          .order("created_at", { ascending: false })
          .limit(10);
        if (revs) setReviews(revs);
        if (count !== null) setReviewCount(count);
      }

      // Load admin review (public)
      const { data: adminRev } = await supabase
        .from("venue_ratings_by_admin")
        .select("*")
        .eq("venue_id", id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (adminRev) setAdminReview(adminRev);

      setLoading(false);
    };
    load();
  }, [id]);

  /* ── loading / not found ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <p className="font-display font-bold text-lg text-foreground">Venue not found</p>
        <button onClick={() => navigate(-1)} className="text-primary text-sm font-medium">Go back</button>
      </div>
    );
  }

  const avgRating = venue.rating ?? 0;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [venue.address, venue.area, venue.city].filter(Boolean).join(", ")
  )}`;

  const formatTime = (t: string | null) => {
    if (!t) return null;
    const [h, m] = t.split(":");
    const hr = parseInt(h, 10);
    const ampm = hr >= 12 ? "PM" : "AM";
    return `${hr % 12 || 12}:${m} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>

        {viewerRole === "artist" && (
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-info text-info-foreground text-xs font-medium">
            <Heart size={13} /> Follow Venue
          </button>
        )}
      </div>

      {/* Cover */}
      <div className="relative h-[200px] w-full overflow-hidden">
        {venue.cover_photo_url ? (
          <img src={venue.cover_photo_url} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-info/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-info/40 to-info/80" />
      </div>

      {/* Logo */}
      <div className="flex justify-center -mt-10 relative z-10">
        <div className="h-20 w-20 rounded-full border-[3px] border-white overflow-hidden bg-info/10 flex items-center justify-center shadow-lg">
          {venue.logo_url ? (
            <img src={venue.logo_url} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-display font-bold text-info">
              {(venue.venue_name || "V")[0].toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Name, type, meta */}
      <div className="px-5 mt-2 text-center space-y-2">
        <div className="flex items-center justify-center gap-1.5">
          <h1 className="font-display font-bold text-2xl text-foreground">
            {venue.venue_name || "Venue"}
          </h1>
          {venue.verified && <BadgeCheck size={20} className="text-info fill-info/20" />}
        </div>

        {venue.venue_type && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-info/10 text-info">
            {venue.venue_type}
          </span>
        )}

        {venue.capacity && (
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Users size={14} />
            <span className="font-body text-[13px]">Capacity: {venue.capacity} guests</span>
          </div>
        )}

        {(venue.address || venue.area || venue.city) && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary font-body text-[13px] hover:underline"
          >
            <MapPin size={14} />
            {[venue.area, venue.city].filter(Boolean).join(", ")}
          </a>
        )}

        {(venue.operating_hours_start || venue.operating_hours_end) && (
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Clock size={13} />
            <span className="font-body text-[13px]">
              {formatTime(venue.operating_hours_start)} – {formatTime(venue.operating_hours_end)}
            </span>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="px-5 mt-6 space-y-6">
        {/* Admin Verified Review */}
        {adminReview && (
          <section className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <BadgeCheck size={18} className="text-primary fill-primary/20" />
              <span className="font-display font-bold text-sm text-primary">Venue Verified by GigZnation Team</span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} className={cn(i < adminReview.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")} />
              ))}
              <span className="text-sm font-semibold text-foreground ml-1">{adminReview.rating}/5</span>
            </div>
            {adminReview.notes && <p className="text-sm text-muted-foreground italic">"{adminReview.notes}"</p>}
            {adminReview.category_ratings && typeof adminReview.category_ratings === "object" && (
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                {Object.entries(adminReview.category_ratings as Record<string, number>).map(([cat, val]) => (
                  <div key={cat} className="flex items-center gap-1">
                    <span>{cat}:</span>
                    <span className="font-semibold text-foreground">{val}/5</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {/* About */}
        {venue.description && (
          <section>
            <h3 className="font-display font-bold text-base text-foreground mb-1">About</h3>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              {venue.description}
            </p>
          </section>
        )}

        {/* Amenities grid */}
        <section className="space-y-3">
          <h3 className="font-display font-bold text-base text-foreground">Stage & Technical Setup</h3>
          <div className="grid grid-cols-4 gap-3">
            {AMENITY_LIST.map(({ key, label, icon: Icon }) => {
              const available = !!venue.amenities[key];
              return (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "h-11 w-11 rounded-xl flex items-center justify-center",
                      available ? "bg-info/10" : "bg-muted"
                    )}
                  >
                    <Icon size={20} className={cn(available ? "text-info" : "text-muted-foreground/40")} />
                  </div>
                  <span
                    className={cn(
                      "font-body text-[10px] text-center leading-tight",
                      available ? "text-foreground" : "text-muted-foreground/50"
                    )}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Past Performances — horizontal scroll */}
        {pastBookings.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-display font-bold text-base text-foreground">Past Performances</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
              {pastBookings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => navigate(`/artist/${b.artist_id}`)}
                  className="shrink-0 w-[140px] rounded-xl border border-card-border bg-card p-3 text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-display font-bold text-primary mb-2">
                    {(b.artist_name || "A")[0].toUpperCase()}
                  </div>
                  <p className="font-display font-semibold text-sm text-foreground truncate">
                    {b.artist_name || "Artist"}
                  </p>
                  {b.artist_genre && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE9FF] text-primary">
                      {b.artist_genre}
                    </span>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {format(new Date(b.date), "dd MMM yyyy")}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Gigs */}
        {gigs.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-display font-bold text-base text-foreground">Upcoming Gigs</h3>
            <div className="space-y-2">
              {gigs.map((g) => (
                <div key={g.id} className="rounded-xl border border-card-border bg-card p-3">
                  <p className="font-display font-semibold text-sm text-foreground">{g.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {g.date && (
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(g.date), "dd MMM yyyy")}
                      </span>
                    )}
                    {g.genre && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-info/10 text-info">
                        {g.genre}
                      </span>
                    )}
                    {g.budget !== null && (
                      <span className="font-display font-bold text-xs text-accent">
                        ₹{g.budget.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews with category breakdowns */}
        <section className="space-y-3">
          <h3 className="font-display font-bold text-base text-foreground">
            Reviews from Artists {reviewCount > 0 && `(${reviewCount})`}
          </h3>

          {/* Category breakdown (simulated from avg) */}
          {reviewCount > 0 && (
            <div className="rounded-xl border border-card-border bg-card p-4 space-y-2.5">
              {REVIEW_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="font-body text-xs text-muted-foreground w-[120px] shrink-0">
                    {cat}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-info"
                      style={{ width: `${(avgRating / 5) * 100}%` }}
                    />
                  </div>
                  <span className="font-body text-xs font-medium text-foreground w-6 text-right">
                    {avgRating.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-card-border bg-card p-3 space-y-1.5">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={cn(
                          i < r.rating
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-muted-foreground/30"
                        )}
                      />
                    ))}
                  </div>
                  {r.comment && (
                    <p className="font-body text-sm text-muted-foreground">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sticky Message Button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-background/90 backdrop-blur border-t border-card-border">
        <button
          onClick={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { navigate("/login"); return; }
            if (session.user.id === venue.user_id) return;
            const dmKey = `dm-${[session.user.id, venue.user_id].sort().join("-")}`;
            navigate(`/chat/${dmKey}`, {
              state: { otherId: venue.user_id, otherName: venue.venue_name || "Venue", otherPhoto: venue.logo_url || venue.cover_photo_url },
            });
          }}
          className="w-full h-[52px] rounded-btn bg-info text-info-foreground font-display font-bold text-base hover:opacity-90 transition"
        >
          Message Venue
        </button>
      </div>
    </div>
  );
};

export default VenuePublicProfile;
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Star, BadgeCheck, Instagram, Youtube, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import AvailabilityCalendar from "@/components/artist-profile/AvailabilityCalendar";
import type { ArtistProfileData } from "@/pages/ArtistProfile";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

const ArtistPublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ArtistProfileData | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [adminReview, setAdminReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        setLoading(false);
        return;
      }

      setProfile({
        ...data,
        avatar_url: (data as any).avatar_url ?? null,
        media_urls: Array.isArray(data.media_urls) ? (data.media_urls as string[]) : [],
        availability:
          data.availability && typeof data.availability === "object" && !Array.isArray(data.availability)
            ? (data.availability as Record<string, "available" | "unavailable">)
            : {},
      });

      // Load reviews
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("artist_id", id);

      if (bookings?.length) {
        const bookingIds = bookings.map((b) => b.id);
        const { data: revs, count } = await supabase
          .from("reviews")
          .select("*", { count: "exact" })
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false })
          .limit(10);
        if (revs) setReviews(revs);
        if (count !== null) setReviewCount(count);
      }

      // Load admin review (public visibility)
      const { data: adminRev } = await supabase
        .from("artist_ratings_by_admin")
        .select("*")
        .eq("artist_id", id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (adminRev) setAdminReview(adminRev);

      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <p className="font-display font-bold text-lg text-foreground">Artist not found</p>
        <button onClick={() => navigate(-1)} className="text-primary text-sm font-medium">Go back</button>
      </div>
    );
  }

  const avgRating = profile.rating ?? 0;
  const socialLinks = (profile as any).social_links as Record<string, string> | null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-3 left-4 z-30 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
      >
        <ArrowLeft size={18} className="text-foreground" />
      </button>

      {/* Cover Banner */}
      <div className="relative h-[200px] w-full overflow-hidden">
        {profile.cover_photo_url ? (
          <img src={profile.cover_photo_url} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-primary/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 to-primary/80" />
      </div>

      {/* Avatar */}
      <div className="flex justify-center -mt-10 relative z-10">
        <div className="h-20 w-20 rounded-full border-[3px] border-white overflow-hidden bg-primary/10 flex items-center justify-center shadow-lg">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-display font-bold text-primary">
              {(profile.stage_name || "A")[0].toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Name & verified */}
      <div className="px-5 mt-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <h1 className="font-display font-bold text-2xl text-foreground">
            {profile.stage_name || "Artist"}
          </h1>
          {profile.verified && (
            <BadgeCheck size={20} className="text-primary fill-primary/20" />
          )}
        </div>

        {/* City */}
        {profile.city && (
          <div className="mt-1 flex items-center justify-center gap-1 text-muted-foreground">
            <MapPin size={13} />
            <span className="font-body text-sm">{profile.city}</span>
          </div>
        )}

        {/* Genre pills */}
        {profile.genre && (
          <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
            {profile.genre.split(",").map((g) => (
              <span key={g.trim()} className="px-3 py-1 rounded-full text-xs font-medium bg-[#EDE9FF] text-primary">
                {g.trim()}
              </span>
            ))}
          </div>
        )}

        {/* Star rating */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={15}
              className={cn(
                i < Math.round(avgRating)
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-muted-foreground/30"
              )}
            />
          ))}
          <span className="font-body text-[13px] font-semibold text-foreground ml-1">
            {avgRating.toFixed(1)}
          </span>
          <span className="font-body text-[13px] text-muted-foreground">
            ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="px-5 mt-6 space-y-6">
        {/* Admin Verified Review */}
        {adminReview && (
          <section className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <BadgeCheck size={18} className="text-primary fill-primary/20" />
              <span className="font-display font-bold text-sm text-primary">Verified by GigZnation Team</span>
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
        {/* Bio */}
        {profile.bio && (
          <section>
            <h3 className="font-display font-bold text-base text-foreground mb-1">About</h3>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
          </section>
        )}

        {/* Media Gallery */}
        {profile.media_urls.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-display font-bold text-base text-foreground">Media</h3>
            <div className="grid grid-cols-3 gap-2">
              {profile.media_urls.slice(0, 6).map((url, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-card-border bg-card">
                  {url.match(/\.(mp4|webm|mov)$/i) ? (
                    <video
                      src={url}
                      className="h-full w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img src={url} alt={`Media ${i + 1}`} className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Performance Stats */}
        <section className="space-y-3">
          <h3 className="font-display font-bold text-base text-foreground">Performance Stats</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Gigs", value: profile.total_gigs ?? 0 },
              { label: "Avg Rating", value: avgRating.toFixed(1) },
              { label: "Cities Performed", value: profile.city ? 1 : 0 },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-card-border bg-card p-3 text-center">
                <div className="font-display font-bold text-xl text-primary">{stat.value}</div>
                <div className="font-body text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        {(profile.min_price !== null || profile.max_price !== null) && (
          <section className="space-y-1">
            <h3 className="font-display font-bold text-base text-foreground">Pricing</h3>
            <p className="font-display font-bold text-xl text-accent">
              {profile.min_price !== null && profile.max_price !== null
                ? `₹${profile.min_price.toLocaleString("en-IN")} – ₹${profile.max_price.toLocaleString("en-IN")}`
                : profile.min_price !== null
                ? `From ₹${profile.min_price.toLocaleString("en-IN")}`
                : `Up to ₹${profile.max_price!.toLocaleString("en-IN")}`}
            </p>
          </section>
        )}

        {/* Availability (read-only) */}
        {Object.keys(profile.availability).length > 0 && (
          <AvailabilityCalendar
            availability={profile.availability}
            onUpdate={() => {}}
            readOnly
          />
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-display font-bold text-base text-foreground">
              Reviews ({reviewCount})
            </h3>
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-card-border bg-card p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
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
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success">
                      <BadgeCheck size={10} /> Verified Booking
                    </span>
                  </div>
                  {r.comment && (
                    <p className="font-body text-sm text-muted-foreground">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Social Links */}
        {socialLinks && Object.values(socialLinks).some(Boolean) && (
          <section className="space-y-3">
            <h3 className="font-display font-bold text-base text-foreground">Connect</h3>
            <div className="flex items-center gap-3">
              {socialLinks.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                  className="h-10 w-10 rounded-full bg-card border border-card-border flex items-center justify-center hover:border-primary transition">
                  <Instagram size={18} className="text-foreground" />
                </a>
              )}
              {socialLinks.youtube && (
                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer"
                  className="h-10 w-10 rounded-full bg-card border border-card-border flex items-center justify-center hover:border-primary transition">
                  <Youtube size={18} className="text-foreground" />
                </a>
              )}
              {socialLinks.spotify && (
                <a href={socialLinks.spotify} target="_blank" rel="noopener noreferrer"
                  className="h-10 w-10 rounded-full bg-card border border-card-border flex items-center justify-center hover:border-primary transition">
                  <Music size={18} className="text-foreground" />
                </a>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Sticky Book Button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-background/90 backdrop-blur border-t border-card-border flex gap-3">
        <button
          onClick={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { navigate("/login"); return; }
            if (session.user.id === profile.user_id) return;
            const dmKey = `dm-${[session.user.id, profile.user_id].sort().join("-")}`;
            navigate(`/chat/${dmKey}`, {
              state: { otherId: profile.user_id, otherName: profile.stage_name || "Artist", otherPhoto: profile.avatar_url },
            });
          }}
          className="h-[52px] px-5 rounded-btn border border-primary text-primary font-display font-bold text-sm shrink-0"
        >
          Message
        </button>
        <button
          onClick={() => navigate(`/artist/${id}/book`)}
          className="flex-1 h-[52px] rounded-btn bg-accent text-accent-foreground font-display font-bold text-base hover:opacity-90 transition"
        >
          Book This Artist
        </button>
      </div>
    </div>
  );
};

export default ArtistPublicProfile;
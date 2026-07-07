import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const ARTIST_CATEGORIES = ["Sound Quality", "Payment Timeliness", "Hospitality", "Overall"];
const VENUE_CATEGORIES = ["Performance Quality", "Professionalism", "Punctuality", "Stage Presence"];

/* ─── Star Row ─── */
const StarRow = ({
  label,
  value,
  onChange,
  size = 28,
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) => {
  const [hover, setHover] = useState(0);

  const getStarValue = (idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return x < rect.width / 2 ? idx + 0.5 : idx + 1;
  };

  return (
    <div className="flex items-center justify-between">
      {label && <span className="font-body text-sm text-foreground">{label}</span>}
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 5 }).map((_, i) => {
          const display = hover || value;
          const full = display >= i + 1;
          const half = !full && display >= i + 0.5;

          return (
            <button
              key={i}
              type="button"
              onMouseMove={(e) => setHover(getStarValue(i, e))}
              onClick={(e) => onChange(getStarValue(i, e))}
              className="relative focus:outline-none"
              style={{ width: size, height: size }}
            >
              {/* Background star */}
              <Star
                size={size}
                className="absolute inset-0 text-muted-foreground/25"
              />
              {/* Filled star */}
              {full && (
                <Star
                  size={size}
                  className="absolute inset-0 text-yellow-400 fill-yellow-400"
                />
              )}
              {/* Half star */}
              {half && (
                <div className="absolute inset-0 overflow-hidden" style={{ width: size / 2 }}>
                  <Star
                    size={size}
                    className="text-yellow-400 fill-yellow-400"
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Main ─── */
const RateReview = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [booking, setBooking] = useState<any>(null);
  const [role, setRole] = useState<"artist" | "venue" | null>(null);
  const [reviewee, setReviewee] = useState<any>(null);
  const [revieweeId, setRevieweeId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [otherReviewed, setOtherReviewed] = useState(false);
  const [otherName, setOtherName] = useState("");

  // Form
  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!bookingId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUserId(user.id);

      // Get role
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const r = roles?.[0]?.role as "artist" | "venue" | undefined;
      if (!r) return;
      setRole(r);

      // Get booking
      const { data: b } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      if (!b) { setLoading(false); return; }
      setBooking(b);

      // Get the other party
      if (r === "artist") {
        setRevieweeId(b.venue_id);
        const { data: v } = await supabase.from("venue_profiles").select("*").eq("id", b.venue_id).maybeSingle();
        if (v) { setReviewee(v); setOtherName(v.venue_name || "Venue"); }
      } else {
        setRevieweeId(b.artist_id);
        const { data: a } = await supabase.from("artist_profiles").select("*").eq("id", b.artist_id).maybeSingle();
        if (a) { setReviewee(a); setOtherName(a.stage_name || "Artist"); }
      }

      // Check if already reviewed
      const { data: existing } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("reviewer_id", user.id);
      if (existing?.length) setAlreadyReviewed(true);

      // Check if other party reviewed
      const { data: otherReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", bookingId)
        .neq("reviewer_id", user.id);
      if (otherReview?.length) setOtherReviewed(true);

      setLoading(false);
    };
    load();
  }, [bookingId, navigate]);

  const categories = role === "artist" ? ARTIST_CATEGORIES : VENUE_CATEGORIES;
  const maxChars = 500;
  const remaining = maxChars - comment.length;

  const isValid = overallRating > 0 && Object.keys(categoryRatings).length === categories.length
    && Object.values(categoryRatings).every((v) => v > 0);

  const handleSubmit = async () => {
    if (!isValid || !bookingId) return;
    setSubmitting(true);

    const { error } = await supabase.from("reviews").insert({
      booking_id: bookingId,
      reviewer_id: userId,
      reviewee_id: revieweeId,
      rating: overallRating,
      comment: comment.trim() || null,
      category_ratings: categoryRatings as any,
    });

    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Review submitted!", description: otherReviewed ? "Both reviews are now live!" : "Your review will go live once the other party submits theirs." });
    navigate("/bookings");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <p className="font-display font-bold text-lg text-foreground">Booking not found</p>
        <button onClick={() => navigate(-1)} className="text-primary text-sm font-medium">Go back</button>
      </div>
    );
  }

  // Already reviewed — waiting state
  if (alreadyReviewed) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-card-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full bg-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="font-display font-bold text-xl text-foreground">Review Submitted</h1>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          {!otherReviewed ? (
            <>
              <Loader2 size={32} className="text-[hsl(174,95%,32%)] animate-spin mb-4" />
              <p className="font-display font-semibold text-base text-foreground">
                Waiting for {otherName} to submit their review...
              </p>
              <p className="font-body text-sm text-muted-foreground mt-2 max-w-xs">
                Both reviews will go live simultaneously once the other party submits.
              </p>
            </>
          ) : (
            <>
              <p className="font-display font-semibold text-base text-foreground">
                Both reviews are now live! 🎉
              </p>
              <button
                onClick={() => navigate("/bookings")}
                className="mt-4 px-6 h-10 rounded-btn bg-primary text-primary-foreground font-display font-bold text-sm"
              >
                Back to Bookings
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const revieweePhoto = role === "artist"
    ? reviewee?.logo_url || reviewee?.cover_photo_url
    : reviewee?.cover_photo_url;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-card-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full bg-card flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="font-display font-bold text-[22px] text-foreground">Rate Your Experience</h1>
      </div>

      <div className="px-5 mt-5 space-y-6">
        {/* Profile card */}
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
            {revieweePhoto ? (
              <img src={revieweePhoto} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-display font-bold text-primary text-2xl">
                {otherName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <p className="font-display font-semibold text-base text-foreground mt-2">{otherName}</p>
          {booking.date && (
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              {format(new Date(booking.date + "T00:00:00"), "MMMM d, yyyy")}
            </p>
          )}
        </div>

        {/* Overall rating */}
        <div className="space-y-2">
          <p className="font-display font-semibold text-sm text-foreground text-center">Overall Rating</p>
          <div className="flex justify-center">
            <StarRow value={overallRating} onChange={setOverallRating} size={36} />
          </div>
          {overallRating > 0 && (
            <p className="text-center font-body text-xs text-muted-foreground">{overallRating} / 5</p>
          )}
        </div>

        {/* Category ratings */}
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-4">
          <h3 className="font-display font-semibold text-sm text-foreground">Category Ratings</h3>
          {categories.map((cat) => (
            <StarRow
              key={cat}
              label={cat}
              value={categoryRatings[cat] || 0}
              onChange={(v) => setCategoryRatings((prev) => ({ ...prev, [cat]: v }))}
              size={22}
            />
          ))}
        </div>

        {/* Written review */}
        <div className="space-y-2">
          <h3 className="font-display font-semibold text-[15px] text-foreground">Write a Review</h3>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, maxChars))}
            placeholder="Share your experience with the community..."
            rows={4}
            className="w-full rounded-btn border border-card-border bg-background px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition resize-none h-[120px]"
          />
          <p className={cn(
            "text-right font-body text-[11px]",
            remaining < 50 ? "text-accent" : "text-muted-foreground"
          )}>
            {remaining} characters remaining
          </p>
        </div>

        {/* Waiting indicator */}
        {!otherReviewed && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
            <Loader2 size={14} className="text-[hsl(174,95%,32%)] animate-spin" />
            <span className="font-body text-xs text-muted-foreground">
              Waiting for {otherName} to submit their review...
            </span>
          </div>
        )}
      </div>

      {/* Submit button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-background/90 backdrop-blur border-t border-card-border">
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className={cn(
            "w-full h-[52px] rounded-btn font-display font-bold text-base transition",
            isValid && !submitting
              ? "bg-accent text-accent-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {submitting ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </div>
  );
};

export default RateReview;

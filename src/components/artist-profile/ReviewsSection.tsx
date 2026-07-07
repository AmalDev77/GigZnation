import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface Props {
  artistProfileId: string;
}

const ReviewsSection = ({ artistProfileId }: Props) => {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const load = async () => {
      // Get bookings for this artist, then reviews for those bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("artist_id", artistProfileId);

      if (!bookings?.length) return;

      const bookingIds = bookings.map(b => b.id);
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false });

      if (data) setReviews(data);
    };
    load();
  }, [artistProfileId]);

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Reviews</h3>
      {reviews.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="rounded-xl border border-card-border bg-card p-3 space-y-1">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    className={i < r.rating ? "text-accent fill-accent" : "text-muted-foreground/30"}
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
  );
};

export default ReviewsSection;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface PastBooking {
  id: string;
  date: string;
  artist: { stage_name: string | null; genre: string | null; avatar_url?: string | null } | null;
}

interface Props {
  venueProfileId: string;
}

const VenuePastPerformances = ({ venueProfileId }: Props) => {
  const [bookings, setBookings] = useState<PastBooking[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, date, artist_id")
        .eq("venue_id", venueProfileId)
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(10);

      if (!data?.length) return;

      // Fetch artist info
      const artistIds = [...new Set(data.map(b => b.artist_id))];
      const { data: artists } = await supabase
        .from("artist_profiles")
        .select("id, stage_name, genre")
        .in("id", artistIds);

      const artistMap = new Map(artists?.map(a => [a.id, a]) || []);

      setBookings(data.map(b => ({
        id: b.id,
        date: b.date,
        artist: artistMap.get(b.artist_id) || null,
      })));
    };
    load();
  }, [venueProfileId]);

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Past Performances</h3>
      {bookings.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">No past performances yet.</p>
      ) : (
        <div className="space-y-2">
          {bookings.map(b => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-display font-bold text-primary shrink-0">
                {(b.artist?.stage_name || "A")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-foreground truncate">
                  {b.artist?.stage_name || "Artist"}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {b.artist?.genre && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EDE9FF] text-primary">
                      {b.artist.genre}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(b.date), "dd MMM yyyy")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default VenuePastPerformances;

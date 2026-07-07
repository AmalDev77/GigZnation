import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";

interface Gig {
  id: string;
  title: string;
  genre: string | null;
  date: string | null;
  budget: number | null;
  status: string;
}

interface Props {
  venueProfileId: string;
}

const VenueUpcomingGigs = ({ venueProfileId }: Props) => {
  const [gigs, setGigs] = useState<Gig[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("gig_posts")
        .select("id, title, genre, date, budget, status")
        .eq("venue_id", venueProfileId)
        .order("date", { ascending: true })
        .limit(10);
      if (data) setGigs(data);
    };
    load();
  }, [venueProfileId]);

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Upcoming Gigs</h3>
      {gigs.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">No gigs posted yet.</p>
      ) : (
        <div className="space-y-2">
          {gigs.map(g => (
            <div key={g.id} className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-3">
              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <CalendarDays size={18} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-foreground truncate">{g.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {g.genre && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-info/10 text-info">
                      {g.genre}
                    </span>
                  )}
                  {g.date && (
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(g.date), "dd MMM yyyy")}
                    </span>
                  )}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success capitalize">
                {g.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default VenueUpcomingGigs;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CalendarIcon, Loader2, Search } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const GENRES = ["Music", "Comedy", "Dance", "Spoken Word", "DJ", "Theatre", "Band", "Visual Performance"];
const DURATIONS = ["1 hour", "1.5 hours", "2 hours", "3 hours", "4+ hours"];

const PostGig = () => {
  const navigate = useNavigate();
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueCity, setVenueCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState<Date>();
  const [duration, setDuration] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "invite">("public");
  const [artistSearch, setArtistSearch] = useState("");
  const [artistCount, setArtistCount] = useState<number | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      const { data: venue } = await supabase
        .from("venue_profiles")
        .select("id, city")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!venue) { navigate("/"); toast.error("Only venues can post gigs"); return; }
      setVenueId(venue.id);
      setVenueCity(venue.city);
      setLoading(false);
    };
    init();
  }, [navigate]);

  // Count artists in budget range
  useEffect(() => {
    const count = async () => {
      const min = parseFloat(minBudget);
      const max = parseFloat(maxBudget);
      if (isNaN(min) && isNaN(max)) { setArtistCount(null); return; }
      let query = supabase.from("artist_profiles").select("id", { count: "exact", head: true });
      if (!isNaN(min)) query = query.gte("min_price", min);
      if (!isNaN(max)) query = query.lte("max_price", max);
      const { count: c } = await query;
      setArtistCount(c ?? 0);
    };
    const t = setTimeout(count, 400);
    return () => clearTimeout(t);
  }, [minBudget, maxBudget]);

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const durationToTimes = (dur: string): { start: string; end: string } => {
    const hours: Record<string, number> = { "1 hour": 1, "1.5 hours": 1.5, "2 hours": 2, "3 hours": 3, "4+ hours": 4 };
    const h = hours[dur] || 2;
    return { start: "19:00", end: `${19 + h}:00`.replace("20:", "20:").padStart(5, "0") };
  };

  const isValid = title.trim() && selectedGenres.length > 0 && eventDate && duration && description.trim();

  const handleSubmit = async () => {
    if (!isValid || !venueId) return;
    setSubmitting(true);
    const { start, end } = durationToTimes(duration);
    const { error } = await supabase.from("gig_posts").insert({
      venue_id: venueId,
      title: title.trim(),
      genre: selectedGenres.join(", "),
      date: format(eventDate!, "yyyy-MM-dd"),
      start_time: start,
      end_time: end,
      budget: parseFloat(maxBudget) || parseFloat(minBudget) || null,
      description: description.trim(),
      city: venueCity,
      status: visibility === "public" ? "open" : "invite",
    });
    setSubmitting(false);
    if (error) { toast.error("Failed to post gig"); return; }
    toast.success("Gig posted! Artists will start applying soon.");
    navigate("/gig-board");
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background animate-fade-in pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur px-4 py-3 border-b border-card-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          <div>
            <h1 className="text-[22px] font-display font-bold text-foreground">Post a Gig</h1>
            <p className="text-sm text-muted-foreground">Let artists apply to perform at your event</p>
          </div>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-6">
        {/* Title */}
        <FormSection label="Gig Title">
          <Input
            placeholder="e.g. Live Music Night, Comedy Open Mic..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-12 rounded-btn border-card-border focus:border-primary"
          />
        </FormSection>

        {/* Genre */}
        <FormSection label="Genre Needed">
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                  selectedGenres.includes(g)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-card-border hover:border-primary/50"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Event Date */}
        <FormSection label="Event Date">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full h-12 rounded-btn border-card-border justify-start text-left font-normal", !eventDate && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {eventDate ? format(eventDate, "PPP") : "Select event date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={eventDate}
                onSelect={setEventDate}
                disabled={date => date < addDays(new Date(), 1)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </FormSection>

        {/* Duration */}
        <FormSection label="Duration">
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="h-12 rounded-btn border-card-border">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormSection>

        {/* Budget Range */}
        <FormSection label="Budget Range">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                type="number"
                placeholder="Min"
                value={minBudget}
                onChange={e => setMinBudget(e.target.value)}
                className="h-12 rounded-btn border-card-border pl-7 focus:border-primary"
              />
            </div>
            <span className="text-muted-foreground font-medium">—</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                type="number"
                placeholder="Max"
                value={maxBudget}
                onChange={e => setMaxBudget(e.target.value)}
                className="h-12 rounded-btn border-card-border pl-7 focus:border-primary"
              />
            </div>
          </div>
          {artistCount !== null && (
            <p className="text-xs font-medium mt-1.5" style={{ color: "hsl(174,95%,32%)" }}>
              Artists in this range: {artistCount}
            </p>
          )}
        </FormSection>

        {/* Description */}
        <FormSection label="Description">
          <div className="relative">
            <Textarea
              placeholder="Describe your event: vibe, audience, dress code, special requirements..."
              value={description}
              onChange={e => { if (e.target.value.length <= 400) setDescription(e.target.value); }}
              className="min-h-[120px] rounded-btn border-card-border resize-none focus:border-primary"
            />
            <span className="absolute bottom-2 right-3 text-[11px] text-muted-foreground">{description.length}/400</span>
          </div>
        </FormSection>

        {/* Visibility */}
        <FormSection label="Visibility">
          <div className="flex gap-2">
            {([
              { value: "public" as const, label: "Public", desc: "Appears on Gig Board" },
              { value: "invite" as const, label: "Invite Only", desc: "Send to specific artists" },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setVisibility(opt.value)}
                className={cn(
                  "flex-1 p-3 rounded-card border text-left transition-colors",
                  visibility === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-card-border bg-card hover:border-primary/30"
                )}
              >
                <span className="text-sm font-display font-semibold text-foreground">{opt.label}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          {visibility === "invite" && (
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search artists to invite..."
                value={artistSearch}
                onChange={e => setArtistSearch(e.target.value)}
                className="h-12 rounded-btn border-card-border pl-10 focus:border-primary"
              />
            </div>
          )}
        </FormSection>
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-card-border">
        <Button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full h-12 rounded-btn bg-accent hover:bg-accent/90 text-white font-display font-semibold text-base disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Post Gig"}
        </Button>
      </div>
    </div>
  );
};

const FormSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-[15px] font-display font-semibold text-foreground mb-2">{label}</h3>
    {children}
  </div>
);

export default PostGig;

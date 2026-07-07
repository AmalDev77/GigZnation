import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Star, CalendarIcon, Clock, Timer, Sparkles, IndianRupee } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const DURATIONS = ["1 hour", "1.5 hours", "2 hours", "3 hours", "4 hours", "Custom"];
const EVENT_TYPES = ["Private Party", "Corporate Event", "Resto-bar Night", "Open Mic", "Wedding", "Other"];
const TIME_SLOTS = Array.from({ length: 30 }, (_, i) => {
  const h = Math.floor(i / 2) + 9;
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

const FEE_PERCENT = 0.1;

const BookArtist = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [artist, setArtist] = useState<any>(null);
  const [venueProfile, setVenueProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [eventDate, setEventDate] = useState<Date>();
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("");
  const [eventType, setEventType] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  // Unavailable dates from artist availability
  const unavailableDates = useMemo(() => {
    if (!artist?.availability) return new Set<string>();
    const avail = artist.availability as Record<string, string>;
    const dates = new Set<string>();
    Object.entries(avail).forEach(([date, status]) => {
      if (status === "unavailable") dates.add(date);
    });
    return dates;
  }, [artist]);

  const isDateDisabled = (date: Date) => {
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
    return unavailableDates.has(format(date, "yyyy-MM-dd"));
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { navigate("/login"); return; }

      const [artistRes, venueRes] = await Promise.all([
        supabase.from("artist_profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("venue_profiles").select("*").eq("user_id", userData.user.id).maybeSingle(),
      ]);

      if (artistRes.data) setArtist(artistRes.data);
      if (venueRes.data) setVenueProfile(venueRes.data);
      setLoading(false);
    };
    load();
  }, [id, navigate]);

  const budgetNum = parseFloat(budget) || 0;
  const fee = Math.round(budgetNum * FEE_PERCENT);
  const artistReceives = budgetNum - fee;

  const isValid = eventDate && startTime && duration && eventType && budgetNum > 0 && venueProfile;

  const handleSubmit = async () => {
    if (!isValid || !artist || !venueProfile) return;
    setSubmitting(true);

    // Calculate end time
    let endTime = startTime;
    const durationHours = duration === "Custom" ? 2 : parseFloat(duration);
    const [h, m] = startTime.split(":").map(Number);
    const endH = h + Math.floor(durationHours);
    const endM = m + (durationHours % 1) * 60;
    endTime = `${String(endH + Math.floor(endM / 60)).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;

    const { data, error } = await supabase.from("bookings").insert({
      artist_id: artist.id,
      venue_id: venueProfile.id,
      date: format(eventDate!, "yyyy-MM-dd"),
      start_time: startTime,
      end_time: endTime,
      amount: budgetNum,
      status: "pending",
      notes: `${eventType}${notes ? " | " + notes : ""}`,
    }).select("id").single();

    setSubmitting(false);
    if (error || !data) {
      toast({ title: "Error", description: error?.message || "Failed to create booking", variant: "destructive" });
      return;
    }
    toast({ title: "Booking request sent!", description: `Your request has been sent to ${artist.stage_name || "the artist"}.` });
    navigate(`/venue-booking/${data.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <p className="font-display font-bold text-lg text-foreground">Artist not found</p>
        <button onClick={() => navigate(-1)} className="text-primary text-sm font-medium">Go back</button>
      </div>
    );
  }

  const avgRating = artist.rating ?? 0;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-card-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full bg-card flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="font-display font-bold text-xl text-foreground">
          Book {artist.stage_name || "Artist"}
        </h1>
      </div>

      <div className="px-5 mt-4 space-y-5">
        {/* Artist summary card */}
        <div className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {artist.cover_photo_url ? (
              <img src={artist.cover_photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-display font-bold text-primary text-lg">
                {(artist.stage_name || "A")[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-sm text-foreground truncate">{artist.stage_name || "Artist"}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {artist.genre && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">{artist.genre.split(",")[0]}</span>}
              {artist.city && <span>{artist.city}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={11} className={cn(i < Math.round(avgRating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")} />
                ))}
              </div>
              {(artist.min_price || artist.max_price) && (
                <span className="font-display font-bold text-xs text-accent">
                  ₹{(artist.min_price ?? 0).toLocaleString("en-IN")} – ₹{(artist.max_price ?? 0).toLocaleString("en-IN")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section heading */}
        <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
          <Sparkles size={16} className="text-primary" /> Event Details
        </h2>

        {/* Event Date */}
        <div className="space-y-1.5">
          <label className="font-body text-sm font-medium text-foreground">Event Date *</label>
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "w-full h-12 rounded-btn border px-3 flex items-center gap-2 text-sm font-body transition",
                eventDate ? "text-foreground border-card-border" : "text-muted-foreground border-card-border",
                "focus:border-primary focus:ring-1 focus:ring-primary"
              )}>
                <CalendarIcon size={16} className="text-muted-foreground" />
                {eventDate ? format(eventDate, "PPP") : "Select date"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={eventDate}
                onSelect={setEventDate}
                disabled={isDateDisabled}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Start Time */}
        <div className="space-y-1.5">
          <label className="font-body text-sm font-medium text-foreground">Start Time *</label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger className="h-12 rounded-btn border-card-border focus:border-primary">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-muted-foreground" />
                <SelectValue placeholder="Select time" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="font-body text-sm font-medium text-foreground">Duration *</label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="h-12 rounded-btn border-card-border focus:border-primary">
              <div className="flex items-center gap-2">
                <Timer size={16} className="text-muted-foreground" />
                <SelectValue placeholder="Select duration" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Event Type */}
        <div className="space-y-1.5">
          <label className="font-body text-sm font-medium text-foreground">Event Type *</label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="h-12 rounded-btn border-card-border focus:border-primary">
              <SelectValue placeholder="Select event type" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Budget */}
        <div className="space-y-1.5">
          <label className="font-body text-sm font-medium text-foreground">Budget (INR) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-muted-foreground">₹</span>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="15000"
              className="w-full h-12 rounded-btn border border-card-border bg-background pl-8 pr-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            />
          </div>
          {budgetNum > 0 && (
            <p className="font-body text-xs text-muted-foreground">
              GigZnation fee: ₹{fee.toLocaleString("en-IN")} · Artist receives: ₹{artistReceives.toLocaleString("en-IN")}
            </p>
          )}
        </div>

        {/* Additional Requirements */}
        <div className="space-y-1.5">
          <label className="font-body text-sm font-medium text-foreground">Additional Requirements</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Sound setup needed? Dress code? Special requirements?"
            rows={3}
            className="w-full rounded-btn border border-card-border bg-background px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition resize-none h-24"
          />
        </div>
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
          {submitting ? "Sending..." : "Send Booking Request"}
        </button>
      </div>
    </div>
  );
};

export default BookArtist;

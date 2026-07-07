import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Star, MapPin, CalendarIcon, Clock, Timer, FileText, MessageSquare, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";

const FEE_PERCENT = 0.1;

const VenueBookingDetail = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [booking, setBooking] = useState<any>(null);
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [acceptingCounter, setAcceptingCounter] = useState(false);
  const [decliningCounter, setDecliningCounter] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!bookingId) return;
      const { data: b } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();

      if (!b) { setLoading(false); return; }
      setBooking(b);

      const { data: a } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("id", b.artist_id)
        .maybeSingle();
      if (a) setArtist(a);
      setLoading(false);
    };
    load();
  }, [bookingId]);

  // Realtime
  useEffect(() => {
    if (!bookingId) return;
    const channel = supabase
      .channel(`venue-booking-${bookingId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => setBooking(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bookingId]);

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId!);
    setCancelling(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Booking cancelled", description: "The artist has been notified." });
    setShowCancel(false);
  };

  const handleAcceptCounter = async () => {
    setAcceptingCounter(true);
    const { error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", bookingId!);
    setAcceptingCounter(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Counter accepted!", description: "Booking is now confirmed." });
  };

  const handleDeclineCounter = async () => {
    setDecliningCounter(true);
    const { error } = await supabase.from("bookings").update({ status: "declined" }).eq("id", bookingId!);
    setDecliningCounter(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Counter declined", description: "The booking has been declined." });
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

  const amount = booking.amount ?? 0;
  const commission = Math.round(amount * FEE_PERCENT);
  const totalCharged = amount + commission;
  const status = booking.status as string;

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: "Pending", bg: "bg-[hsl(25,100%,96%)]", text: "text-accent" },
    confirmed: { label: "Confirmed", bg: "bg-success/10", text: "text-success" },
    cancelled: { label: "Cancelled", bg: "bg-destructive/10", text: "text-destructive" },
    declined: { label: "Declined", bg: "bg-destructive/10", text: "text-destructive" },
    counter_offer: { label: "Counter Offer", bg: "bg-primary/10", text: "text-primary" },
  };
  const badge = statusConfig[status] ?? statusConfig.pending;

  const eventType = booking.notes?.split("|")[0]?.trim() || "Event";

  let durationText = "";
  if (booking.start_time && booking.end_time) {
    const [sh, sm] = booking.start_time.split(":").map(Number);
    const [eh, em] = booking.end_time.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    durationText = mins >= 60 ? `${(mins / 60).toFixed(1).replace(/\.0$/, "")} hours` : `${mins} mins`;
  }

  const requirementsText = booking.notes
    ?.split("|")
    .slice(1)
    .filter((s: string) => !s.trim().startsWith("Counter:") && !s.trim().startsWith("Declined:"))
    .join("")
    .trim();

  // Parse counter offer from notes
  const counterMatch = booking.notes?.match(/Counter: date=([^,]*), time=([^,]*), budget=₹(\d+)/);
  const hasCounterOffer = status === "counter_offer" && counterMatch;

  const avgRating = artist?.rating ?? 0;
  const canCancel = status === "pending" || status === "confirmed";

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-card-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full bg-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="font-display font-bold text-xl text-foreground">Booking Detail</h1>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", badge.bg, badge.text)}>
          {badge.label}
        </span>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {/* Artist summary card */}
        {artist && (
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
              <p className="font-display font-semibold text-[15px] text-foreground truncate">{artist.stage_name || "Artist"}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {artist.genre && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                    {artist.genre.split(",")[0]}
                  </span>
                )}
                {artist.city && (
                  <span className="flex items-center gap-0.5">
                    <MapPin size={10} /> {artist.city}
                  </span>
                )}
              </div>
              <div className="flex mt-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={11} className={cn(i < Math.round(avgRating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Event details card */}
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Event Details</h3>
          <div className="space-y-2.5">
            {[
              { icon: CalendarIcon, label: "Event Date", value: booking.date ? format(new Date(booking.date + "T00:00:00"), "PPP") : "—" },
              { icon: Clock, label: "Start Time", value: booking.start_time?.slice(0, 5) || "—" },
              { icon: Timer, label: "Duration", value: durationText || "—" },
              { icon: FileText, label: "Event Type", value: eventType },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <row.icon size={15} className="text-muted-foreground shrink-0" />
                <span className="font-body text-xs text-muted-foreground w-24">{row.label}</span>
                <span className="font-body text-sm text-foreground">{row.value}</span>
              </div>
            ))}
            {requirementsText && (
              <div className="flex items-start gap-3 pt-1 border-t border-card-border">
                <MessageSquare size={15} className="text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="font-body text-xs text-muted-foreground block">Requirements</span>
                  <span className="font-body text-sm text-foreground">{requirementsText}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fee card */}
        <div className="rounded-xl border border-card-border bg-card p-4 text-center space-y-1">
          <p className="font-body text-xs text-muted-foreground">Offered Fee</p>
          <p className="font-display font-bold text-2xl text-accent">
            ₹{amount.toLocaleString("en-IN")}
          </p>
          <div className="font-body text-xs text-muted-foreground space-y-0.5 pt-1">
            <p>GigZnation commission: ₹{commission.toLocaleString("en-IN")}</p>
            <p>Total charged to you: <span className="font-semibold text-foreground">₹{totalCharged.toLocaleString("en-IN")}</span></p>
          </div>
        </div>

        {/* Confirmed state */}
        {status === "confirmed" && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-success shrink-0" />
              <div>
                <p className="font-display font-semibold text-sm text-success">Booking Confirmed</p>
                <p className="font-body text-xs text-muted-foreground">The artist has accepted. Complete your payment to finalise.</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/payment/${bookingId}`)}
              className="w-full h-11 rounded-btn bg-accent text-accent-foreground font-display font-bold text-sm hover:opacity-90 transition"
            >
              Complete Payment
            </button>
          </div>
        )}

        {/* Counter offer card */}
        {hasCounterOffer && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <h3 className="font-display font-semibold text-sm text-primary flex items-center gap-2">
              <AlertTriangle size={14} /> Artist Counter Offer
            </h3>
            <div className="space-y-2">
              {counterMatch[1] !== "same" && (
                <div className="flex justify-between">
                  <span className="font-body text-xs text-muted-foreground">Proposed Date</span>
                  <span className="font-body text-sm text-foreground">{counterMatch[1]}</span>
                </div>
              )}
              {counterMatch[2] !== "same" && (
                <div className="flex justify-between">
                  <span className="font-body text-xs text-muted-foreground">Proposed Time</span>
                  <span className="font-body text-sm text-foreground">{counterMatch[2]}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-body text-xs text-muted-foreground">Proposed Budget</span>
                <span className="font-display font-bold text-base text-accent">₹{parseInt(counterMatch[3]).toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAcceptCounter}
                disabled={acceptingCounter}
                className="flex-1 h-10 rounded-btn bg-success text-white font-display font-bold text-sm transition hover:opacity-90"
              >
                {acceptingCounter ? "Accepting..." : "Accept Counter"}
              </button>
              <button
                onClick={handleDeclineCounter}
                disabled={decliningCounter}
                className="flex-1 h-10 rounded-btn border-2 border-destructive text-destructive font-display font-bold text-sm transition hover:bg-destructive/5"
              >
                {decliningCounter ? "Declining..." : "Decline Counter"}
              </button>
            </div>
          </div>
        )}

        {/* Message thread preview */}
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MessageSquare size={14} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-sm text-muted-foreground truncate">
                Start a conversation with {artist?.stage_name || "the artist"}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/messages")}
            className="mt-2 font-body text-xs font-semibold text-primary hover:underline"
          >
            View Full Thread →
          </button>
        </div>

        {/* Cancel link */}
        {canCancel && (
          <button
            onClick={() => setShowCancel(true)}
            className="w-full text-center font-body text-sm text-destructive hover:underline pt-2"
          >
            Cancel Booking
          </button>
        )}
      </div>

      {/* Cancel bottom sheet */}
      <Drawer open={showCancel} onOpenChange={setShowCancel}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="font-display text-lg">Cancel Booking</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
              <p className="font-body text-sm text-foreground">
                Cancellations within 48 hours of the event are non-refundable. Are you sure you want to cancel?
              </p>
            </div>
          </div>
          <DrawerFooter>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full h-[48px] rounded-btn bg-destructive text-destructive-foreground font-display font-bold text-base transition"
            >
              {cancelling ? "Cancelling..." : "Confirm Cancel"}
            </button>
            <DrawerClose asChild>
              <button className="w-full h-10 font-body text-sm text-muted-foreground">Go Back</button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default VenueBookingDetail;

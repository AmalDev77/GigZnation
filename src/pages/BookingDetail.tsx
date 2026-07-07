import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Star, MapPin, CalendarIcon, Clock, Timer, FileText, MessageSquare, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";

const FEE_PERCENT = 0.1;
const DECLINE_REASONS = [
  "Schedule conflict",
  "Budget too low",
  "Not the right fit",
  "Venue too far",
  "Other",
];

const BookingDetail = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [booking, setBooking] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Counter offer state
  const [showCounter, setShowCounter] = useState(false);
  const [counterDate, setCounterDate] = useState("");
  const [counterTime, setCounterTime] = useState("");
  const [counterBudget, setCounterBudget] = useState("");
  const [counterSubmitting, setCounterSubmitting] = useState(false);

  // Decline state
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  const [accepting, setAccepting] = useState(false);

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

      const { data: v } = await supabase
        .from("venue_profiles")
        .select("*")
        .eq("id", b.venue_id)
        .maybeSingle();
      if (v) setVenue(v);
      setLoading(false);
    };
    load();
  }, [bookingId]);

  // Realtime subscription
  useEffect(() => {
    if (!bookingId) return;
    const channel = supabase
      .channel(`booking-${bookingId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => setBooking(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bookingId]);

  const handleAccept = async () => {
    setAccepting(true);
    const { error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", bookingId!);
    setAccepting(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Booking confirmed!", description: "The venue has been notified." });
  };

  const handleCounter = async () => {
    if (!counterBudget) return;
    setCounterSubmitting(true);
    const updates: any = { status: "counter_offer" };
    if (counterDate) updates.date = counterDate;
    if (counterTime) updates.start_time = counterTime;
    if (counterBudget) updates.amount = parseFloat(counterBudget);
    updates.notes = (booking.notes || "") + ` | Counter: date=${counterDate || "same"}, time=${counterTime || "same"}, budget=₹${counterBudget}`;

    const { error } = await supabase.from("bookings").update(updates).eq("id", bookingId!);
    setCounterSubmitting(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Counter offer sent!", description: "The venue will review your proposal." });
    setShowCounter(false);
  };

  const handleDecline = async () => {
    setDeclining(true);
    const { error } = await supabase.from("bookings").update({
      status: "declined",
      notes: (booking.notes || "") + (declineReason ? ` | Declined: ${declineReason}` : " | Declined"),
    }).eq("id", bookingId!);
    setDeclining(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Booking declined", description: "The venue has been notified." });
    setShowDecline(false);
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
  const fee = Math.round(amount * FEE_PERCENT);
  const netAmount = amount - fee;
  const status = booking.status as string;

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: "Pending", bg: "bg-[hsl(25,100%,96%)]", text: "text-accent" },
    confirmed: { label: "Confirmed", bg: "bg-success/10", text: "text-success" },
    declined: { label: "Declined", bg: "bg-destructive/10", text: "text-destructive" },
    counter_offer: { label: "Counter Sent", bg: "bg-primary/10", text: "text-primary" },
  };
  const badge = statusConfig[status] ?? statusConfig.pending;

  // Parse event type from notes
  const eventType = booking.notes?.split("|")[0]?.trim() || "Event";

  // Duration calc
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

  const isPending = status === "pending";

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-card-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full bg-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="font-display font-bold text-xl text-foreground">Booking Request</h1>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", badge.bg, badge.text)}>
          {badge.label}
        </span>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {/* Venue summary card */}
        {venue && (
          <div className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-3">
            <div className="h-12 w-12 rounded-full bg-[hsl(174,95%,32%)]/10 flex items-center justify-center overflow-hidden shrink-0">
              {venue.logo_url ? (
                <img src={venue.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display font-bold text-[hsl(174,95%,32%)] text-lg">
                  {(venue.venue_name || "V")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-[15px] text-foreground truncate">{venue.venue_name || "Venue"}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {venue.venue_type && (
                  <span className="px-2 py-0.5 rounded-full bg-[hsl(174,95%,32%)]/10 text-[hsl(174,95%,32%)] text-[11px] font-medium">
                    {venue.venue_type}
                  </span>
                )}
                {venue.city && (
                  <span className="flex items-center gap-0.5">
                    <MapPin size={10} /> {venue.city}
                  </span>
                )}
              </div>
              <div className="flex mt-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={11} className={cn(i < Math.round(venue.rating ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")} />
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
        <div className="rounded-xl border border-card-border bg-card p-4 text-center">
          <p className="font-body text-xs text-muted-foreground">Offered Fee</p>
          <p className="font-display font-bold text-2xl text-accent mt-1">
            ₹{amount.toLocaleString("en-IN")}
          </p>
          <p className="font-body text-xs text-muted-foreground mt-1">
            After GigZnation commission: <span className="font-semibold text-foreground">₹{netAmount.toLocaleString("en-IN")}</span>
          </p>
        </div>

        {/* Confirmed state */}
        {status === "confirmed" && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-success shrink-0" />
            <div>
              <p className="font-display font-semibold text-sm text-success">Booking Confirmed</p>
              <p className="font-body text-xs text-muted-foreground">Payment request has been sent to the venue.</p>
            </div>
          </div>
        )}

        {/* Counter offer form (inline) */}
        {showCounter && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <h3 className="font-display font-semibold text-sm text-primary">Counter Offer</h3>
            <div className="space-y-2">
              <div>
                <label className="font-body text-xs text-muted-foreground">Proposed Date</label>
                <input
                  type="date"
                  value={counterDate}
                  onChange={(e) => setCounterDate(e.target.value)}
                  className="w-full h-10 rounded-btn border border-card-border bg-background px-3 font-body text-sm text-foreground focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground">Proposed Time</label>
                <input
                  type="time"
                  value={counterTime}
                  onChange={(e) => setCounterTime(e.target.value)}
                  className="w-full h-10 rounded-btn border border-card-border bg-background px-3 font-body text-sm text-foreground focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground">Proposed Budget (₹) *</label>
                <input
                  type="number"
                  value={counterBudget}
                  onChange={(e) => setCounterBudget(e.target.value)}
                  placeholder="20000"
                  className="w-full h-10 rounded-btn border border-card-border bg-background px-3 font-body text-sm text-foreground focus:border-primary outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCounter}
                disabled={!counterBudget || counterSubmitting}
                className={cn(
                  "flex-1 h-10 rounded-btn font-display font-bold text-sm transition",
                  counterBudget && !counterSubmitting
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {counterSubmitting ? "Sending..." : "Send Counter"}
              </button>
              <button
                onClick={() => setShowCounter(false)}
                className="px-4 h-10 rounded-btn border border-card-border font-body text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons — only for pending */}
      {isPending && !showCounter && (
        <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-background/90 backdrop-blur border-t border-card-border space-y-2">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full h-[48px] rounded-btn bg-success text-white font-display font-bold text-base hover:opacity-90 transition"
          >
            {accepting ? "Confirming..." : "Accept"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCounter(true)}
              className="flex-1 h-[44px] rounded-btn border-2 border-accent text-accent font-display font-bold text-sm hover:bg-accent/5 transition"
            >
              Counter Offer
            </button>
            <button
              onClick={() => setShowDecline(true)}
              className="flex-1 h-[44px] rounded-btn border-2 border-destructive text-destructive font-display font-bold text-sm hover:bg-destructive/5 transition"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Decline bottom sheet */}
      <Drawer open={showDecline} onOpenChange={setShowDecline}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="font-display text-lg">Decline Booking</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2 space-y-2">
            <p className="font-body text-sm text-muted-foreground">Please select a reason (optional):</p>
            {DECLINE_REASONS.map((reason) => (
              <label key={reason} className="flex items-center gap-3 p-3 rounded-lg border border-card-border cursor-pointer hover:bg-muted/50 transition">
                <input
                  type="radio"
                  name="decline"
                  value={reason}
                  checked={declineReason === reason}
                  onChange={() => setDeclineReason(reason)}
                  className="accent-destructive"
                />
                <span className="font-body text-sm text-foreground">{reason}</span>
              </label>
            ))}
          </div>
          <DrawerFooter>
            <button
              onClick={handleDecline}
              disabled={declining}
              className="w-full h-[48px] rounded-btn bg-destructive text-destructive-foreground font-display font-bold text-base transition"
            >
              {declining ? "Declining..." : "Confirm Decline"}
            </button>
            <DrawerClose asChild>
              <button className="w-full h-10 font-body text-sm text-muted-foreground">Cancel</button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default BookingDetail;

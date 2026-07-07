import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Lock, AlertCircle, CheckCircle2, CalendarIcon, Clock, Timer, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const COMMISSION_PERCENT = 0.1;
const GST_PERCENT = 0.18;

const Payment = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [booking, setBooking] = useState<any>(null);
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState(false);

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
        .select("stage_name, genre, city")
        .eq("id", b.artist_id)
        .maybeSingle();
      if (a) setArtist(a);
      setLoading(false);
    };
    load();
  }, [bookingId]);

  const artistFee = booking?.amount ?? 0;
  const commission = Math.round(artistFee * COMMISSION_PERCENT);
  const subtotal = artistFee + commission;
  const gst = Math.round(subtotal * GST_PERCENT);
  const total = subtotal + gst;

  const eventType = booking?.notes?.split("|")[0]?.trim() || "Event";

  let durationText = "";
  if (booking?.start_time && booking?.end_time) {
    const [sh, sm] = booking.start_time.split(":").map(Number);
    const [eh, em] = booking.end_time.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    durationText = mins >= 60 ? `${(mins / 60).toFixed(1).replace(/\.0$/, "")} hours` : `${mins} mins`;
  }

  const handlePay = async () => {
    setPaying(true);
    setPaymentError(false);

    // ─────────────────────────────────────────────────────────────────────
    // ⚠️ TEST-MODE PAYMENT SIMULATION — not a real payment gateway.
    // This just waits 2s and randomly succeeds/fails so the rest of the
    // booking flow (confirmation, review, admin dashboards) can be built
    // and tested end-to-end. Before going live, replace this block with a
    // real integration, e.g.:
    //   1. Create a Supabase Edge Function (e.g. `create-payment-order`)
    //      that uses your Stripe/Razorpay SECRET key (set via
    //      `supabase secrets set STRIPE_SECRET_KEY=...`) to create a
    //      PaymentIntent/Order for `totalAmount`.
    //   2. Call that function from here via `supabase.functions.invoke(...)`,
    //      then use the returned client secret with Stripe Elements /
    //      Razorpay Checkout to actually collect card details.
    //   3. Only mark the booking "paid" after your gateway's webhook (again,
    //      an Edge Function) confirms the charge succeeded server-side —
    //      never trust a client-side "success" the way this stub does.
    // ─────────────────────────────────────────────────────────────────────
    await new Promise((r) => setTimeout(r, 2000));

    // 90% success rate for testing
    const success = Math.random() > 0.1;

    if (success) {
      await supabase.from("bookings").update({ status: "paid" }).eq("id", bookingId!);
      toast({ title: "Payment successful! (test mode)", description: "Your booking is confirmed." });
      navigate(`/payment-success/${bookingId}`);
    } else {
      setPaymentError(true);
    }
    setPaying(false);
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

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-card-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full bg-card flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="font-display font-bold text-xl text-foreground">Complete Payment</h1>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {/* Booking summary card */}
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Booking Summary</h3>
          <div className="space-y-2.5">
            {[
              { icon: null, label: "Artist", value: artist?.stage_name || "Artist" },
              { icon: CalendarIcon, label: "Event Date", value: booking.date ? format(new Date(booking.date + "T00:00:00"), "PPP") : "—" },
              { icon: Clock, label: "Time", value: booking.start_time?.slice(0, 5) || "—" },
              { icon: Timer, label: "Duration", value: durationText || "—" },
              { icon: FileText, label: "Event Type", value: eventType },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="font-body text-xs text-muted-foreground">{row.label}</span>
                <span className="font-body text-sm text-foreground font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fee breakdown */}
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold text-sm text-foreground">Artist Fee</span>
            <span className="font-display font-semibold text-sm text-foreground">
              ₹{artistFee.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-body text-xs text-muted-foreground">
              GigZnation Commission ({(COMMISSION_PERCENT * 100).toFixed(0)}%)
            </span>
            <span className="font-body text-xs text-muted-foreground">
              ₹{commission.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-body text-xs text-muted-foreground">
              GST ({(GST_PERCENT * 100).toFixed(0)}%)
            </span>
            <span className="font-body text-xs text-muted-foreground">
              ₹{gst.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="border-t border-card-border pt-3 flex items-center justify-between">
            <span className="font-display font-bold text-base text-foreground">Total Amount</span>
            <span className="font-display font-bold text-[22px] text-accent">
              ₹{total.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Payment method */}
        <div className="space-y-2">
          <h3 className="font-display font-semibold text-sm text-foreground">Payment Method</h3>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="font-display font-bold text-xs text-primary">UPI</span>
            </div>
            <div className="flex-1">
              <p className="font-body text-sm text-foreground font-medium">UPI / Net Banking / Cards</p>
              <p className="font-body text-[11px] text-muted-foreground">Powered by Razorpay (mock mode)</p>
            </div>
            <CheckCircle2 size={18} className="text-primary" />
          </div>
        </div>

        {/* Payment error */}
        {paymentError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-destructive shrink-0" />
            <div className="flex-1">
              <p className="font-display font-semibold text-sm text-destructive">Payment Failed</p>
              <p className="font-body text-xs text-muted-foreground">Something went wrong. Please try again.</p>
            </div>
            <button
              onClick={handlePay}
              className="px-3 py-1.5 rounded-btn border border-destructive text-destructive font-display font-bold text-xs shrink-0"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Bottom pay button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-background/90 backdrop-blur border-t border-card-border">
        <button
          onClick={handlePay}
          disabled={paying}
          className={cn(
            "w-full h-[52px] rounded-btn font-display font-bold text-base transition",
            paying
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-accent text-accent-foreground hover:opacity-90"
          )}
        >
          {paying ? "Processing..." : `Proceed to Pay ₹${total.toLocaleString("en-IN")}`}
        </button>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <Lock size={11} className="text-muted-foreground" />
          <span className="font-body text-[11px] text-muted-foreground">
            Secured by Razorpay · 256-bit encryption
          </span>
        </div>
      </div>
    </div>
  );
};

export default Payment;
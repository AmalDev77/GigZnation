import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Instagram, CalendarIcon, Clock, MapPin, User, IndianRupee } from "lucide-react";
import { format } from "date-fns";

/* ─── Confetti ─── */
const CONFETTI_COLORS = [
  "hsl(263,45%,55%)", // purple
  "hsl(263,45%,70%)",
  "hsl(17,88%,66%)", // orange
  "hsl(17,88%,78%)",
  "hsl(263,100%,90%)",
  "hsl(17,100%,90%)",
];

interface Particle {
  x: number; y: number; r: number; d: number;
  color: string; tilt: number; tiltAngle: number; tiltInc: number;
  opacity: number;
}

const Confetti = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -1,
      r: Math.random() * 6 + 4,
      d: Math.random() * 80 + 20,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngle: 0,
      tiltInc: Math.random() * 0.07 + 0.05,
      opacity: 1,
    }));

    let frame = 0;
    const maxFrames = 120; // ~2 seconds at 60fps

    const draw = () => {
      if (frame >= maxFrames) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.tiltAngle += p.tiltInc;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) * 0.8;
        p.x += Math.sin(frame * 0.01);
        p.tilt = Math.sin(p.tiltAngle) * 15;
        p.opacity = Math.max(0, 1 - frame / maxFrames);

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      frame++;
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
    />
  );
};

/* ─── Animated Checkmark ─── */
const AnimatedCheck = () => (
  <div className="relative h-24 w-24 mx-auto mb-5">
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {/* Circle */}
      <circle
        cx="50" cy="50" r="45"
        fill="none"
        stroke="hsl(152,68%,38%)"
        strokeWidth="4"
        strokeDasharray="283"
        strokeDashoffset="283"
        className="animate-[circle-draw_0.6s_ease-out_forwards]"
      />
      {/* Fill */}
      <circle
        cx="50" cy="50" r="43"
        fill="hsl(152,68%,38%)"
        opacity="0"
        className="animate-[circle-fill_0.3s_ease-out_0.5s_forwards]"
      />
      {/* Checkmark */}
      <path
        d="M30 52 L44 66 L70 38"
        fill="none"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="60"
        strokeDashoffset="60"
        className="animate-[check-draw_0.4s_ease-out_0.7s_forwards]"
      />
    </svg>
  </div>
);

/* ─── Main Component ─── */
const PaymentSuccess = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<any>(null);
  const [artist, setArtist] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!bookingId) return;
      const { data: b } = await supabase
        .from("bookings").select("*").eq("id", bookingId).maybeSingle();
      if (!b) { setLoading(false); return; }
      setBooking(b);

      const [aRes, vRes] = await Promise.all([
        supabase.from("artist_profiles").select("stage_name, genre, city").eq("id", b.artist_id).maybeSingle(),
        supabase.from("venue_profiles").select("venue_name, city").eq("id", b.venue_id).maybeSingle(),
      ]);
      if (aRes.data) setArtist(aRes.data);
      if (vRes.data) setVenue(vRes.data);
      setLoading(false);
    };
    load();
  }, [bookingId]);

  const generateShareImage = useCallback(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d")!;

    // Purple gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, "#7C5CBF");
    grad.addColorStop(1, "#5B3D99");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Decorative circles
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(200, 400, 300, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(900, 1500, 250, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // GigZnation logo text
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GigZnation", 540, 320);

    // Main text
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 64px sans-serif";
    ctx.fillText("We're performing at", 540, 780);

    ctx.font = "bold 80px sans-serif";
    ctx.fillStyle = "#F4845F";
    const venueName = venue?.venue_name || "an amazing venue";
    ctx.fillText(venueName, 540, 900);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 56px sans-serif";
    const dateText = booking?.date
      ? format(new Date(booking.date + "T00:00:00"), "MMMM d, yyyy")
      : "";
    ctx.fillText(`on ${dateText}`, 540, 1020);

    // Artist name
    ctx.font = "bold 48px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(artist?.stage_name || "Artist", 540, 1200);

    // Orange accent line
    ctx.fillStyle = "#F4845F";
    ctx.fillRect(440, 1280, 200, 4);

    // Footer
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "28px sans-serif";
    ctx.fillText("gigznation.com", 540, 1750);

    // Download
    const link = document.createElement("a");
    link.download = "gigznation-booking.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [booking, artist, venue]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const amount = booking?.amount ?? 0;
  const commission = Math.round(amount * 0.1);
  const gst = Math.round((amount + commission) * 0.18);
  const total = amount + commission + gst;
  const eventType = booking?.notes?.split("|")[0]?.trim() || "Event";

  let durationText = "";
  if (booking?.start_time && booking?.end_time) {
    const [sh, sm] = booking.start_time.split(":").map(Number);
    const [eh, em] = booking.end_time.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    durationText = mins >= 60 ? `${(mins / 60).toFixed(1).replace(/\.0$/, "")} hours` : `${mins} mins`;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Confetti />

      {/* Custom keyframes */}
      <style>{`
        @keyframes circle-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes circle-fill {
          to { opacity: 0.15; }
        }
        @keyframes check-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes float-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex flex-col items-center pt-16 px-5">
        {/* Animated checkmark */}
        <AnimatedCheck />

        {/* Heading */}
        <h1
          className="font-display font-bold text-[28px] text-foreground"
          style={{ animation: "float-up 0.5s ease-out 0.8s both" }}
        >
          Booking Confirmed!
        </h1>

        {/* Artist + date */}
        <p
          className="font-display font-semibold text-lg text-primary mt-2 text-center"
          style={{ animation: "float-up 0.5s ease-out 1s both" }}
        >
          {artist?.stage_name || "Artist"} ·{" "}
          {booking?.date ? format(new Date(booking.date + "T00:00:00"), "MMM d, yyyy") : ""}
        </p>

        {/* Summary card */}
        <div
          className="w-full max-w-sm mt-6 rounded-xl border border-card-border bg-card p-4 space-y-2.5"
          style={{ animation: "float-up 0.5s ease-out 1.2s both" }}
        >
          {[
            { label: "Event Date", value: booking?.date ? format(new Date(booking.date + "T00:00:00"), "PPP") : "—" },
            { label: "Time", value: booking?.start_time?.slice(0, 5) || "—" },
            { label: "Duration", value: durationText || "—" },
            { label: "Venue", value: venue?.venue_name || "—" },
            { label: "Artist", value: artist?.stage_name || "—" },
            { label: "Total Paid", value: `₹${total.toLocaleString("en-IN")}`, highlight: true },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="font-body text-xs text-muted-foreground">{row.label}</span>
              <span className={`font-body text-sm font-medium ${row.highlight ? "text-accent font-display font-bold" : "text-foreground"}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div
          className="w-full max-w-sm mt-6 space-y-3"
          style={{ animation: "float-up 0.5s ease-out 1.4s both" }}
        >
          <button
            onClick={() => navigate("/bookings")}
            className="w-full h-[52px] rounded-btn bg-accent text-accent-foreground font-display font-bold text-base hover:opacity-90 transition"
          >
            View Booking
          </button>
          <button
            onClick={generateShareImage}
            className="w-full h-[48px] rounded-btn border-2 border-card-border bg-card font-display font-semibold text-sm text-foreground hover:border-primary transition flex items-center justify-center gap-2"
          >
            <Instagram size={18} className="text-foreground" />
            Share to Instagram Stories
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;

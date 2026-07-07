import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";

const PENDING_CHIPS = ["Sounds good", "Can we adjust the date?", "What's included?"];
const CONFIRMED_CHIPS = ["See you then!", "Any setup requirements?", "Excited for this!"];
const DIRECT_CHIPS = ["Hi! Are you available?", "What are your rates?", "Can you share more details?"];

/** UUIDs are always 36 characters, so a dm-<idA>-<idB> key can be parsed
 *  reliably by fixed offsets without ambiguity from the dashes inside the
 *  UUIDs themselves. */
const parseDmKey = (key: string, myId: string): string | null => {
  if (!key.startsWith("dm-")) return null;
  const rest = key.slice(3);
  if (rest.length !== 73) return null;
  const idA = rest.slice(0, 36);
  const idB = rest.slice(37);
  if (idA === myId) return idB;
  if (idB === myId) return idA;
  return null;
};

const ChatThread = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDirect = !!bookingId?.startsWith("dm-");
  const navState = location.state as { otherId?: string; otherName?: string; otherPhoto?: string | null } | null;

  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"artist" | "venue" | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [otherName, setOtherName] = useState("");
  const [otherPhoto, setOtherPhoto] = useState<string | null>(null);
  const [otherId, setOtherId] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [chipsUsed, setChipsUsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!bookingId) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUserId(user.id);

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const r = roles?.[0]?.role as "artist" | "venue" | undefined;
      if (r) setRole(r);

      /* ── Direct message (no booking) ── */
      if (isDirect) {
        const resolvedOtherId = navState?.otherId || parseDmKey(bookingId, user.id);
        if (!resolvedOtherId) { setNotFound(true); setLoading(false); return; }
        setOtherId(resolvedOtherId);

        if (navState?.otherName) {
          setOtherName(navState.otherName);
          setOtherPhoto(navState.otherPhoto ?? null);
        } else {
          const { data: a } = await supabase.from("artist_profiles").select("stage_name, avatar_url, cover_photo_url").eq("user_id", resolvedOtherId).maybeSingle();
          if (a) {
            setOtherName(a.stage_name || "Artist");
            setOtherPhoto(a.avatar_url || a.cover_photo_url);
          } else {
            const { data: v } = await supabase.from("venue_profiles").select("venue_name, logo_url, cover_photo_url").eq("user_id", resolvedOtherId).maybeSingle();
            if (v) { setOtherName(v.venue_name || "Venue"); setOtherPhoto(v.logo_url || v.cover_photo_url); }
            else {
              const { data: p } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", resolvedOtherId).maybeSingle();
              setOtherName(p?.full_name || "User");
              setOtherPhoto(p?.avatar_url ?? null);
            }
          }
        }

        const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .is("booking_id", null)
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${resolvedOtherId}),and(sender_id.eq.${resolvedOtherId},receiver_id.eq.${user.id})`)
          .order("created_at", { ascending: true });
        setMessages(msgs || []);

        if (msgs?.length) {
          await supabase.from("messages").update({ read: true })
            .is("booking_id", null)
            .eq("receiver_id", user.id)
            .eq("sender_id", resolvedOtherId)
            .eq("read", false);
        }

        setLoading(false);
        return;
      }

      /* ── Booking-scoped conversation ── */
      const { data: b } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      if (!b) { setNotFound(true); setLoading(false); return; }
      setBooking(b);

      if (r === "venue") {
        const { data: a } = await supabase.from("artist_profiles").select("user_id, stage_name, cover_photo_url").eq("id", b.artist_id).maybeSingle();
        if (a) { setOtherName(a.stage_name || "Artist"); setOtherPhoto(a.cover_photo_url); setOtherId(a.user_id); }
      } else {
        const { data: v } = await supabase.from("venue_profiles").select("user_id, venue_name, logo_url, cover_photo_url").eq("id", b.venue_id).maybeSingle();
        if (v) { setOtherName(v.venue_name || "Venue"); setOtherPhoto(v.logo_url || v.cover_photo_url); setOtherId(v.user_id); }
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      setMessages(msgs || []);

      if (msgs?.length) {
        await supabase.from("messages").update({ read: true })
          .eq("booking_id", bookingId)
          .eq("receiver_id", user.id)
          .eq("read", false);
      }

      setLoading(false);
    };
    init();
  }, [bookingId, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!bookingId || !userId || !otherId) return;

    if (isDirect) {
      const channel = supabase
        .channel(`chat-dm-${[userId, otherId].sort().join("-")}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "messages",
          filter: `receiver_id=eq.${userId}`,
        }, (payload) => {
          const m = payload.new as any;
          if (m.booking_id === null && m.sender_id === otherId) {
            setMessages((prev) => [...prev, m]);
            supabase.from("messages").update({ read: true }).eq("id", m.id);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }

    const channel = supabase
      .channel(`chat-${bookingId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `booking_id=eq.${bookingId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        if ((payload.new as any).receiver_id === userId) {
          supabase.from("messages").update({ read: true }).eq("id", (payload.new as any).id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bookingId, userId, otherId, isDirect]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !userId || !otherId) return;
    setSending(true);
    await supabase.from("messages").insert({
      sender_id: userId,
      receiver_id: otherId,
      content: content.trim(),
      booking_id: isDirect ? null : bookingId,
    });
    setText("");
    setSending(false);
    inputRef.current?.focus();
  }, [userId, otherId, bookingId, isDirect]);

  const handleChip = (chip: string) => {
    setChipsUsed(true);
    sendMessage(chip);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(text);
  };

  const detailRoute = role === "artist" ? `/booking/${bookingId}` : `/venue-booking/${bookingId}`;

  const statusConfig: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-orange-100 text-orange-700" },
    counter_offer: { label: "Counter", cls: "bg-primary/10 text-primary" },
    confirmed: { label: "Confirmed", cls: "bg-[#059669]/10 text-[#059669]" },
    paid: { label: "Paid", cls: "bg-[#059669]/10 text-[#059669]" },
    completed: { label: "Completed", cls: "bg-muted text-foreground" },
    cancelled: { label: "Cancelled", cls: "bg-destructive/10 text-destructive" },
    declined: { label: "Declined", cls: "bg-destructive/10 text-destructive" },
  };
  const badge = statusConfig[booking?.status] ?? statusConfig.pending;

  const quickChips = isDirect
    ? DIRECT_CHIPS
    : booking?.status === "confirmed" || booking?.status === "paid"
    ? CONFIRMED_CHIPS
    : PENDING_CHIPS;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <p className="font-display font-bold text-lg text-foreground">Conversation not found</p>
        <button onClick={() => navigate("/messages")} className="text-primary text-sm font-medium">Back to Messages</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-card-border px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full bg-card flex items-center justify-center shrink-0">
          <ArrowLeft size={18} className="text-foreground" />
        </button>

        <div className="h-8 w-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
          {otherPhoto ? (
            <img src={otherPhoto} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display font-bold text-primary text-sm">{otherName[0]?.toUpperCase()}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-[15px] text-foreground truncate">{otherName}</p>
          {isDirect ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-muted text-muted-foreground">Direct Message</span>
          ) : (
            <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-semibold", badge.cls)}>{badge.label}</span>
          )}
        </div>

        {!isDirect && (
          <button
            onClick={() => navigate(detailRoute)}
            className="font-body text-xs font-semibold text-[#7C5CBF] whitespace-nowrap shrink-0"
          >
            View Booking
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="font-body text-sm text-muted-foreground">Start the conversation!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.sender_id === userId;
          const prevMsg = messages[i - 1];
          const showDate = !prevMsg || !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));
          const time = format(new Date(msg.created_at), "h:mm a");

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-body">
                    {format(new Date(msg.created_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              <div className={cn("flex mb-1", isMine ? "justify-end" : "justify-start")}>
                <div className="max-w-[75%]">
                  <div
                    className={cn(
                      "px-3.5 py-2.5 text-sm font-body leading-relaxed",
                      isMine
                        ? "bg-[#7C5CBF] text-white rounded-[16px_16px_2px_16px]"
                        : "bg-white border border-[#E8E4F5] text-[#1A1033] rounded-[16px_16px_16px_2px]"
                    )}
                  >
                    {msg.content}
                  </div>
                  <p className={cn(
                    "text-[11px] text-muted-foreground mt-0.5 font-body",
                    isMine ? "text-right" : "text-left"
                  )}>
                    {time}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-card-border bg-background">
        {!chipsUsed && (
          <div className="px-4 pt-2 flex gap-2 overflow-x-auto no-scrollbar">
            {quickChips.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChip(chip)}
                className="shrink-0 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-body font-medium hover:bg-primary/10 transition"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-10 rounded-full border border-card-border bg-card px-4 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition",
              text.trim() && !sending
                ? "bg-[#7C5CBF] text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatThread;
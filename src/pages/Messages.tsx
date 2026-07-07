import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, VolumeX, Archive, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

interface Thread {
  bookingId: string;
  otherId: string;       // user_id of the other party
  otherName: string;
  otherPhoto: string | null;
  bookingStatus: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
}

/* ─── Swipeable Row ─── */
const SwipeRow = ({ children }: { children: React.ReactNode }) => {
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => {
    const diff = Math.min(0, e.touches[0].clientX - startX.current);
    setOffset(Math.max(diff, -140));
  };
  const onTouchEnd = () => { setOffset(offset < -60 ? -140 : 0); };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 flex">
        <button className="w-[70px] bg-primary flex flex-col items-center justify-center gap-1 text-primary-foreground">
          <VolumeX size={16} /><span className="text-[10px] font-medium">Mute</span>
        </button>
        <button className="w-[70px] bg-destructive flex flex-col items-center justify-center gap-1 text-destructive-foreground">
          <Archive size={16} /><span className="text-[10px] font-medium">Archive</span>
        </button>
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative bg-card transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
};

/* ─── Status Chip ─── */
const StatusChip = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-accent/10 text-accent" },
    counter_offer: { label: "Counter", cls: "bg-primary/10 text-primary" },
    confirmed: { label: "Confirmed", cls: "bg-success/10 text-success" },
    paid: { label: "Paid", cls: "bg-success/10 text-success" },
    completed: { label: "Completed", cls: "bg-muted text-foreground" },
    cancelled: { label: "Cancelled", cls: "bg-destructive/10 text-destructive" },
    declined: { label: "Declined", cls: "bg-destructive/10 text-destructive" },
  };
  const c = config[status] ?? config.pending;
  return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", c.cls)}>{c.label}</span>;
};

/* ─── Main ─── */
const Messages = () => {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const loadThreads = useCallback(async (uid: string) => {
    // Get all messages for this user
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order("created_at", { ascending: false });

    if (!msgs?.length) { setThreads([]); setLoading(false); return; }

    // Group by booking_id
    const groupMap = new Map<string, typeof msgs>();
    msgs.forEach((m: any) => {
      const key = m.booking_id || `dm-${[m.sender_id, m.receiver_id].sort().join("-")}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(m);
    });

    // Build threads
    const threadList: Thread[] = [];
    const otherUserIds = new Set<string>();

    for (const [key, messages] of groupMap) {
      const latest = messages[0];
      const otherId = latest.sender_id === uid ? latest.receiver_id : latest.sender_id;
      otherUserIds.add(otherId);

      const unread = messages.filter((m: any) => m.receiver_id === uid && !m.read).length;

      threadList.push({
        bookingId: latest.booking_id || key,
        otherId,
        otherName: "",
        otherPhoto: null,
        bookingStatus: "pending",
        lastMessage: latest.content,
        lastTime: latest.created_at,
        unreadCount: unread,
      });
    }

    // Fetch booking statuses
    const bookingIds = threadList
      .map(t => t.bookingId)
      .filter(id => !id.startsWith("dm-"));
    if (bookingIds.length) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, status, artist_id, venue_id")
        .in("id", bookingIds);
      const bMap = new Map(bookings?.map((b: any) => [b.id, b]) || []);
      threadList.forEach(t => {
        const b = bMap.get(t.bookingId) as any;
        if (b) t.bookingStatus = b.status;
      });
    }

    // Fetch other party info - try artist_profiles first, then venue_profiles
    const ids = [...otherUserIds];
    const { data: artists } = await supabase
      .from("artist_profiles")
      .select("user_id, stage_name, cover_photo_url")
      .in("user_id", ids);
    const { data: venues } = await supabase
      .from("venue_profiles")
      .select("user_id, venue_name, logo_url, cover_photo_url")
      .in("user_id", ids);

    const nameMap = new Map<string, { name: string; photo: string | null }>();
    artists?.forEach((a: any) => nameMap.set(a.user_id, { name: a.stage_name || "Artist", photo: a.cover_photo_url }));
    venues?.forEach((v: any) => {
      if (!nameMap.has(v.user_id)) {
        nameMap.set(v.user_id, { name: v.venue_name || "Venue", photo: v.logo_url || v.cover_photo_url });
      }
    });

    threadList.forEach(t => {
      const info = nameMap.get(t.otherId);
      if (info) { t.otherName = info.name; t.otherPhoto = info.photo; }
      else t.otherName = "User";
    });

    setThreads(threadList);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      loadThreads(user.id);
    };
    init();
  }, [loadThreads]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("inbox-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        loadThreads(userId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, loadThreads]);

  return (
    <div className="animate-fade-in">
      <header className="px-5 pt-6 pb-3">
        <h1 className="font-display font-bold text-2xl text-foreground">Messages</h1>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && threads.length === 0 && (
        <div className="flex flex-col items-center justify-center px-5 py-20 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <MessageCircle size={28} className="text-muted-foreground" />
          </div>
          <h2 className="font-display font-bold text-lg text-foreground">No messages yet</h2>
          <p className="font-body text-sm text-muted-foreground max-w-xs">
            Book or get booked to start chatting.
          </p>
          <button
            onClick={() => navigate("/discover")}
            className="px-6 h-10 rounded-btn bg-primary text-primary-foreground font-display font-bold text-sm"
          >
            Explore Artists
          </button>
        </div>
      )}

      {/* Thread list */}
      {!loading && threads.length > 0 && (
        <div className="divide-y divide-card-border">
          {threads.map((t) => {
            const isUnread = t.unreadCount > 0;
            const timeAgo = (() => {
              try { return formatDistanceToNowStrict(new Date(t.lastTime), { addSuffix: false }); }
              catch { return ""; }
            })();

            return (
              <SwipeRow key={t.bookingId}>
                <button
                  onClick={() => navigate(`/chat/${t.bookingId}`)}
                  className={cn(
                    "w-full px-5 py-3 flex items-center gap-3 text-left transition",
                    isUnread ? "bg-[hsl(263,60%,95%)]" : "bg-card"
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                      {t.otherPhoto ? (
                        <img src={t.otherPhoto} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display font-bold text-primary text-lg">
                          {t.otherName[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {isUnread && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {t.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        "text-[15px] truncate",
                        isUnread ? "font-display font-bold text-foreground" : "font-display font-semibold text-foreground"
                      )}>
                        {t.otherName}
                      </p>
                      <span className="font-body text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {timeAgo}
                      </span>
                    </div>
                    <div className="mt-0.5">
                      <StatusChip status={t.bookingStatus} />
                    </div>
                    <p className="font-body text-[13px] text-muted-foreground truncate mt-0.5">
                      {t.lastMessage}
                    </p>
                  </div>
                </button>
              </SwipeRow>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Messages;

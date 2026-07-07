import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, AlertTriangle, ArrowUpRight, Clock, FileText, User } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = ["All", "open", "under_review", "resolved", "escalated"];
const RESOLUTION_OPTIONS = [
  "Full Refund to Venue",
  "Partial Refund",
  "Payment Released to Artist",
  "Warning Issued",
  "Both Parties Warned",
  "Dismissed as Invalid",
];

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    open: "bg-destructive/10 text-destructive border-destructive/30",
    under_review: "bg-accent/10 text-accent border-accent/30",
    resolved: "bg-green-100 text-green-700 border-green-300",
    escalated: "bg-orange-100 text-orange-700 border-orange-300",
  };
  return map[s] || "bg-muted text-muted-foreground";
};

const borderColor = (s: string) => {
  if (s === "open" || s === "under_review" || s === "escalated") return "border-l-accent";
  if (s === "resolved") return "border-l-green-500";
  return "";
};

const AdminDisputes = () => {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [internalNotes, setInternalNotes] = useState<Record<string, string>>({});
  const [resolutionType, setResolutionType] = useState<Record<string, string>>({});
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Record<string, any>>({});
  const [artists, setArtists] = useState<Record<string, any>>({});
  const [venues, setVenues] = useState<Record<string, any>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false });
    const list = data || [];
    setDisputes(list);

    // Load related data
    const bookingIds = [...new Set(list.map(d => d.booking_id))];
    if (bookingIds.length) {
      const { data: bData } = await supabase.from("bookings").select("*, artist_profiles(id, stage_name, genre, city, cover_photo_url, user_id), venue_profiles(id, venue_name, city, logo_url, user_id)").in("id", bookingIds);
      const bMap: Record<string, any> = {};
      const aMap: Record<string, any> = {};
      const vMap: Record<string, any> = {};
      (bData || []).forEach(b => {
        bMap[b.id] = b;
        if (b.artist_profiles) aMap[b.artist_id] = b.artist_profiles;
        if (b.venue_profiles) vMap[b.venue_id] = b.venue_profiles;
      });
      setBookings(bMap);
      setArtists(aMap);
      setVenues(vMap);
    }

    // Load reporter profiles
    const reporterIds = [...new Set(list.map(d => d.reporter_id))];
    const resolverIds = [...new Set(list.filter(d => d.resolved_by).map(d => d.resolved_by))];
    const allUserIds = [...new Set([...reporterIds, ...resolverIds])];
    if (allUserIds.length) {
      const { data: pData } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", allUserIds);
      const pMap: Record<string, any> = {};
      (pData || []).forEach(p => { pMap[p.user_id] = p; });
      setProfiles(pMap);

      const { data: aData } = await supabase.from("admin_users").select("user_id, display_name").in("user_id", resolverIds);
      const nMap: Record<string, string> = {};
      (aData || []).forEach(a => { nMap[a.user_id] = a.display_name || "Admin"; });
      setAdminNames(nMap);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "All") return disputes;
    return disputes.filter(d => d.status === filter);
  }, [disputes, filter]);

  const openCount = disputes.filter(d => d.status === "open" || d.status === "under_review" || d.status === "escalated").length;
  const now = new Date();
  const resolvedMonth = disputes.filter(d => d.status === "resolved" && d.resolved_at && new Date(d.resolved_at).getMonth() === now.getMonth() && new Date(d.resolved_at).getFullYear() === now.getFullYear()).length;
  const resolved = disputes.filter(d => d.status === "resolved" && d.resolved_at);
  const avgDays = resolved.length ? Math.round(resolved.reduce((s, d) => s + differenceInDays(new Date(d.resolved_at), new Date(d.created_at)), 0) / resolved.length) : 0;

  const resolveDispute = async (id: string) => {
    if (!resolutionType[id]) { toast.error("Select a resolution type"); return; }
    setActing(id);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("disputes").update({
      status: "resolved",
      resolution: `${resolutionType[id]}${resolutionNotes[id] ? ` — ${resolutionNotes[id]}` : ""}`,
      resolved_by: session!.user.id,
      resolved_at: new Date().toISOString(),
    }).eq("id", id);
    await supabase.from("admin_actions_log").insert({
      admin_id: session!.user.id,
      action: "dispute_resolved",
      target_type: "dispute",
      target_id: id,
      details: { resolution: resolutionType[id], notes: resolutionNotes[id] || "", internal_notes: internalNotes[id] || "" },
    });
    toast.success("Dispute resolved");
    setActing(null);
    load();
  };

  const escalate = async (id: string) => {
    setActing(id);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("disputes").update({ status: "escalated" }).eq("id", id);
    await supabase.from("admin_actions_log").insert({
      admin_id: session!.user.id,
      action: "dispute_escalated",
      target_type: "dispute",
      target_id: id,
      details: { internal_notes: internalNotes[id] || "" },
    });
    toast.success("Dispute escalated");
    setActing(null);
    load();
  };

  const getCategoryLabel = (reason: string) => {
    const cats = ["Payment Not Received", "No-Show", "Quality Complaint", "Inappropriate Behaviour", "Technical Issues"];
    return cats.find(c => reason?.toLowerCase().includes(c.toLowerCase())) || reason || "Other";
  };

  const getReporterRole = (d: any) => {
    const booking = bookings[d.booking_id];
    if (!booking) return "User";
    const artistUserId = artists[booking.artist_id]?.user_id;
    if (d.reporter_id === artistUserId) return "Artist";
    return "Venue";
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl md:text-[28px] font-display font-bold text-foreground">Dispute Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-card-border p-5">
          <p className="text-xs text-muted-foreground font-medium">Open Disputes</p>
          <p className="text-2xl font-display font-bold text-destructive mt-1">{openCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-card-border p-5">
          <p className="text-xs text-muted-foreground font-medium">Resolved This Month</p>
          <p className="text-2xl font-display font-bold text-green-600 mt-1">{resolvedMonth}</p>
        </div>
        <div className="bg-card rounded-xl border border-card-border p-5">
          <p className="text-xs text-muted-foreground font-medium">Avg Resolution Time</p>
          <p className="text-2xl font-display font-bold text-teal-600 mt-1">{avgDays} days</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filter === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {s === "All" ? "All" : s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
            {s === "open" && openCount > 0 && <span className="ml-1.5 bg-destructive text-white text-[10px] rounded-full px-1.5 py-0.5">{disputes.filter(d => d.status === "open").length}</span>}
            {s === "escalated" && <span className="ml-1.5 bg-accent text-white text-[10px] rounded-full px-1.5 py-0.5">{disputes.filter(d => d.status === "escalated").length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-card-border">No disputes found</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(d => {
            const booking = bookings[d.booking_id];
            const artist = booking ? artists[booking.artist_id] : null;
            const venue = booking ? venues[booking.venue_id] : null;
            const reporter = profiles[d.reporter_id];
            const isActionable = d.status === "open" || d.status === "under_review" || d.status === "escalated";

            return (
              <div key={d.id} className={cn("bg-card rounded-xl border border-card-border overflow-hidden border-l-4", borderColor(d.status))}>
                {/* Header */}
                <div className="px-5 pt-5 pb-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">#{d.id.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">Raised {format(new Date(d.created_at), "dd MMM yyyy")}</span>
                    </div>
                    <p className="font-display font-semibold text-foreground mt-1">{getCategoryLabel(d.reason)}</p>
                  </div>
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium capitalize border", statusBadge(d.status))}>{d.status.replace("_", " ")}</span>
                </div>

                {/* Two parties */}
                {(artist || venue) && (
                  <div className="px-5 pb-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 flex items-center gap-3 bg-muted/30 rounded-xl p-3">
                        {artist?.cover_photo_url ? <img src={artist.cover_photo_url} className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div>}
                        <div>
                          <p className="font-semibold text-sm">{artist?.stage_name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">{artist?.genre} • {artist?.city}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">VS</span>
                      <div className="flex-1 flex items-center gap-3 bg-muted/30 rounded-xl p-3">
                        {venue?.logo_url ? <img src={venue.logo_url} className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-secondary/40 flex items-center justify-center"><User className="h-5 w-5 text-muted-foreground" /></div>}
                        <div>
                          <p className="font-semibold text-sm">{venue?.venue_name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">{venue?.city}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Booking details */}
                {booking && (
                  <div className="px-5 pb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>📅 {format(new Date(booking.date), "dd MMM yyyy")}</span>
                    <span>💰 ₹{(booking.amount || 0).toLocaleString("en-IN")}</span>
                    <span className="font-mono">Booking: {booking.id.slice(0, 8)}…</span>
                  </div>
                )}

                {/* Dispute details */}
                <div className="px-5 pb-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Raised By:</span>
                    <Badge variant="outline" className="text-xs">{getReporterRole(d)}</Badge>
                    {reporter && <span className="text-muted-foreground">({reporter.full_name || "User"})</span>}
                  </div>
                  {d.details && (
                    <div className="bg-muted/20 border-l-2 border-muted-foreground/30 rounded-r-lg px-4 py-3 text-sm text-foreground italic">
                      "{d.details}"
                    </div>
                  )}
                </div>

                {/* Resolved info */}
                {d.status === "resolved" && d.resolution && (
                  <div className="px-5 pb-3">
                    <div className="flex items-start gap-2 bg-green-50 rounded-xl p-4">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Resolution: {d.resolution}</p>
                        {d.resolved_by && <p className="text-xs text-green-600 mt-1">Resolved by {adminNames[d.resolved_by] || "Admin"} on {d.resolved_at ? format(new Date(d.resolved_at), "dd MMM yyyy") : "—"}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin actions */}
                {isActionable && (
                  <div className="px-5 pb-5 pt-2 border-t border-card-border space-y-3">
                    <Textarea
                      placeholder="Internal investigation notes (not visible to users)..."
                      value={internalNotes[d.id] || ""}
                      onChange={e => setInternalNotes(prev => ({ ...prev, [d.id]: e.target.value }))}
                      className="min-h-[70px] resize-none text-sm"
                    />
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-xs text-muted-foreground mb-1">Resolution</p>
                        <Select value={resolutionType[d.id] || ""} onValueChange={v => setResolutionType(prev => ({ ...prev, [d.id]: v }))}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Select resolution..." /></SelectTrigger>
                          <SelectContent>{RESOLUTION_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-xs text-muted-foreground mb-1">Resolution Notes</p>
                        <Textarea
                          placeholder="Additional notes..."
                          value={resolutionNotes[d.id] || ""}
                          onChange={e => setResolutionNotes(prev => ({ ...prev, [d.id]: e.target.value }))}
                          className="min-h-[40px] resize-none text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => resolveDispute(d.id)} disabled={acting === d.id} className="bg-green-600 hover:bg-green-700 text-white gap-1">
                        {acting === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        Resolve
                      </Button>
                      {d.status !== "escalated" && (
                        <Button variant="outline" onClick={() => escalate(d.id)} disabled={acting === d.id} className="text-accent border-accent/30 hover:bg-accent/10 gap-1">
                          <ArrowUpRight className="h-4 w-4" />Escalate
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDisputes;

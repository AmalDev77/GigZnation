import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Search, Eye, AlertTriangle, ChevronDown, ChevronUp, Download, CalendarIcon, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["All", "pending", "confirmed", "completed", "cancelled", "disputed"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-accent/10 text-accent border-accent/30",
  confirmed: "bg-green-100 text-green-700 border-green-300",
  completed: "bg-muted text-muted-foreground border-muted",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  disputed: "bg-orange-100 text-orange-700 border-orange-300",
};
const COMMISSION_RATE = 0.1;

const AdminBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [amountRange, setAmountRange] = useState([0, 500000]);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [sortCol, setSortCol] = useState<string>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerBooking, setDrawerBooking] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const perPage = 25;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, artist_profiles(stage_name, genre, city, user_id, rating, cover_photo_url), venue_profiles(venue_name, city, logo_url, user_id)")
        .order("created_at", { ascending: false })
        .limit(1000);
      setBookings(data || []);
      setLoading(false);
    })();
  }, []);

  const cities = useMemo(() => {
    const s = new Set<string>();
    bookings.forEach(b => {
      if (b.artist_profiles?.city) s.add(b.artist_profiles.city);
      if (b.venue_profiles?.city) s.add(b.venue_profiles.city);
    });
    return Array.from(s).sort();
  }, [bookings]);

  const filtered = useMemo(() => {
    let list = bookings;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        (b.artist_profiles?.stage_name || "").toLowerCase().includes(q) ||
        (b.venue_profiles?.venue_name || "").toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "All") list = list.filter(b => b.status === statusFilter);
    if (cityFilter !== "All") list = list.filter(b => b.artist_profiles?.city === cityFilter || b.venue_profiles?.city === cityFilter);
    list = list.filter(b => (b.amount || 0) >= amountRange[0] && (b.amount || 0) <= amountRange[1]);
    if (dateRange.from) list = list.filter(b => new Date(b.date) >= dateRange.from!);
    if (dateRange.to) list = list.filter(b => new Date(b.date) <= dateRange.to!);

    list.sort((a, b) => {
      let va: any, vb: any;
      if (sortCol === "amount" || sortCol === "commission") { va = a.amount || 0; vb = b.amount || 0; }
      else if (sortCol === "date") { va = a.date; vb = b.date; }
      else if (sortCol === "artist") { va = a.artist_profiles?.stage_name || ""; vb = b.artist_profiles?.stage_name || ""; }
      else if (sortCol === "venue") { va = a.venue_profiles?.venue_name || ""; vb = b.venue_profiles?.venue_name || ""; }
      else if (sortCol === "status") { va = a.status; vb = b.status; }
      else { va = a.created_at; vb = b.created_at; }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [bookings, search, statusFilter, cityFilter, amountRange, dateRange, sortCol, sortAsc]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  const totalAll = bookings.length;
  const now = new Date();
  const thisMonth = bookings.filter(b => { const d = new Date(b.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const gmvMonth = thisMonth.reduce((s, b) => s + (b.amount || 0), 0);
  const avgVal = bookings.length ? bookings.reduce((s, b) => s + (b.amount || 0), 0) / bookings.length : 0;

  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };

  const openDrawer = async (b: any) => {
    setDrawerBooking(b);
    const { data: msgs } = await supabase.from("messages").select("*").eq("booking_id", b.id).order("created_at", { ascending: true }).limit(10);
    setMessages(msgs || []);
    const { data: revs } = await supabase.from("reviews").select("*").eq("booking_id", b.id);
    setReviews(revs || []);
  };

  const exportCsv = () => {
    const header = "Booking ID,Artist,Venue,Date,Amount,Commission,Status\n";
    const rows = filtered.map(b => `${b.id},${b.artist_profiles?.stage_name || ""},${b.venue_profiles?.venue_name || ""},${b.date},${b.amount || 0},${Math.round((b.amount || 0) * COMMISSION_RATE)},${b.status}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bookings_export.csv"; a.click();
  };

  const SortHeader = ({ col, label }: { col: string; label: string }) => (
    <th className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(col)}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 opacity-50" /></span>
    </th>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-[28px] font-display font-bold text-foreground">All Platform Bookings</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2"><Download className="h-4 w-4" />Export CSV</Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Bookings", value: totalAll.toLocaleString("en-IN") },
          { label: "Bookings This Month", value: thisMonth.length.toLocaleString("en-IN") },
          { label: "GMV This Month", value: `₹${gmvMonth.toLocaleString("en-IN")}` },
          { label: "Average Booking Value", value: `₹${Math.round(avgVal).toLocaleString("en-IN")}` },
        ].map(m => (
          <div key={m.label} className="bg-card rounded-xl border border-card-border p-5">
            <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
            <p className="text-2xl font-display font-bold text-foreground mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search artist, venue or booking ID..." className="pl-9 h-10" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] h-10"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s === "All" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={v => { setCityFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] h-10"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="All">All Cities</SelectItem>{cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 gap-2"><CalendarIcon className="h-4 w-4" />{dateRange.from ? `${format(dateRange.from, "dd MMM")}${dateRange.to ? ` – ${format(dateRange.to, "dd MMM")}` : ""}` : "Date Range"}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={dateRange as any} onSelect={(r: any) => { setDateRange(r || {}); setPage(0); }} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2 min-w-[180px]">
          <span className="text-xs text-muted-foreground whitespace-nowrap">₹{amountRange[0].toLocaleString("en-IN")}</span>
          <Slider min={0} max={500000} step={1000} value={amountRange} onValueChange={v => { setAmountRange(v); setPage(0); }} className="w-28" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">₹{amountRange[1].toLocaleString("en-IN")}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Showing {filtered.length} bookings</p>

      {/* Table */}
      <div className="bg-card rounded-xl border border-card-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted/30">
                <SortHeader col="id" label="Booking ID" />
                <SortHeader col="artist" label="Artist" />
                <SortHeader col="venue" label="Venue" />
                <SortHeader col="date" label="Event Date" />
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Duration</th>
                <SortHeader col="amount" label="Amount" />
                <SortHeader col="commission" label="Commission" />
                <SortHeader col="status" label="Status" />
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-16"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-muted-foreground">No bookings found</td></tr>
              ) : paged.map(b => {
                const isDisputed = b.status === "disputed";
                const expanded = expandedId === b.id;
                const dur = b.start_time && b.end_time ? (() => { const [sh, sm] = b.start_time.split(":").map(Number); const [eh, em] = b.end_time.split(":").map(Number); const mins = (eh * 60 + em) - (sh * 60 + sm); return mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : "—"; })() : "—";
                return (
                  <>
                    <tr key={b.id} className={cn("border-b border-card-border last:border-0 hover:bg-muted/20 transition-colors", isDisputed && "border-l-4 border-l-accent")} onClick={() => setExpandedId(expanded ? null : b.id)} style={{ cursor: "pointer" }}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {b.artist_profiles?.cover_photo_url ? <img src={b.artist_profiles.cover_photo_url} className="h-7 w-7 rounded-full object-cover" /> : <div className="h-7 w-7 rounded-full bg-primary/20" />}
                          <span className="font-medium">{b.artist_profiles?.stage_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {b.venue_profiles?.logo_url ? <img src={b.venue_profiles.logo_url} className="h-7 w-7 rounded-full object-cover" /> : <div className="h-7 w-7 rounded-full bg-secondary/40" />}
                          <span>{b.venue_profiles?.venue_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(b.date), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{dur}</td>
                      <td className="px-4 py-3 font-semibold text-accent">₹{(b.amount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-muted-foreground">₹{Math.round((b.amount || 0) * COMMISSION_RATE).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize border", STATUS_COLORS[b.status] || "")}>{b.status}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); openDrawer(b); }} className="p-1.5 rounded-lg hover:bg-muted"><Eye className="h-4 w-4 text-primary" /></button>
                          <button onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-muted"><AlertTriangle className="h-4 w-4 text-accent" /></button>
                          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={b.id + "-exp"} className="bg-muted/10">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div><span className="text-muted-foreground">Start Time:</span> <span className="font-medium">{b.start_time || "—"}</span></div>
                            <div><span className="text-muted-foreground">End Time:</span> <span className="font-medium">{b.end_time || "—"}</span></div>
                            <div><span className="text-muted-foreground">City:</span> <span className="font-medium">{b.venue_profiles?.city || b.artist_profiles?.city || "—"}</span></div>
                            <div><span className="text-muted-foreground">Genre:</span> <span className="font-medium">{b.artist_profiles?.genre || "—"}</span></div>
                            <div className="col-span-2 md:col-span-4"><span className="text-muted-foreground">Notes:</span> <span className="font-medium">{b.notes || "No notes"}</span></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!drawerBooking} onOpenChange={o => !o && setDrawerBooking(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {drawerBooking && (
            <>
              <SheetHeader><SheetTitle>Booking Details</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">ID: {drawerBooking.id}</span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize border", STATUS_COLORS[drawerBooking.status])}>{drawerBooking.status}</span>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Artist</p>
                    <p className="font-semibold">{drawerBooking.artist_profiles?.stage_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{drawerBooking.artist_profiles?.genre} • {drawerBooking.artist_profiles?.city}</p>
                    {drawerBooking.artist_profiles?.rating != null && <p className="text-xs mt-1">⭐ {drawerBooking.artist_profiles.rating}</p>}
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Venue</p>
                    <p className="font-semibold">{drawerBooking.venue_profiles?.venue_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{drawerBooking.venue_profiles?.city}</p>
                  </div>
                </div>

                {/* Event */}
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Event Details</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Date:</span> {format(new Date(drawerBooking.date), "dd MMM yyyy")}</div>
                    <div><span className="text-muted-foreground">Time:</span> {drawerBooking.start_time || "—"} – {drawerBooking.end_time || "—"}</div>
                  </div>
                  {drawerBooking.notes && <p className="text-xs text-muted-foreground mt-1">{drawerBooking.notes}</p>}
                </div>

                {/* Payment */}
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Payment Breakdown</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span>Artist Fee</span><span className="font-semibold text-accent">₹{(drawerBooking.amount || 0).toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span>Platform Commission (10%)</span><span>₹{Math.round((drawerBooking.amount || 0) * COMMISSION_RATE).toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>₹{Math.round((drawerBooking.amount || 0) * (1 + COMMISSION_RATE)).toLocaleString("en-IN")}</span></div>
                  </div>
                </div>

                {/* Messages preview */}
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Messages ({messages.length})</p>
                  {messages.length === 0 ? <p className="text-xs text-muted-foreground">No messages</p> : messages.slice(0, 5).map(m => (
                    <div key={m.id} className="bg-muted/20 rounded-lg px-3 py-2 text-xs">
                      <span className="text-muted-foreground">{format(new Date(m.created_at), "dd MMM HH:mm")} — </span>{m.content}
                    </div>
                  ))}
                </div>

                {/* Reviews */}
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Reviews ({reviews.length})</p>
                  {reviews.length === 0 ? <p className="text-xs text-muted-foreground">No reviews yet</p> : reviews.map(r => (
                    <div key={r.id} className="bg-muted/20 rounded-lg px-3 py-2 text-xs">
                      <span>⭐ {r.rating}/5</span>{r.comment && <span className="ml-2 text-muted-foreground">{r.comment}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminBookings;

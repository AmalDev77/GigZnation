import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Search, Download, CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ACTION_TYPES = ["All", "login", "user_blocked", "user_warned", "user_unblocked", "review_added", "dispute_resolved", "feature_flag_changed", "booking_flagged", "dispute_escalated", "artist_rated", "venue_rated", "artist_flagged", "venue_flagged"];

const ACTION_LABELS: Record<string, string> = {
  All: "All Actions",
  login: "Login",
  user_blocked: "User Blocked",
  user_warned: "User Warned",
  user_unblocked: "User Unblocked",
  review_added: "Review Added",
  dispute_resolved: "Dispute Resolved",
  feature_flag_changed: "Feature Flag Changed",
  booking_flagged: "Booking Flagged",
  dispute_escalated: "Dispute Escalated",
  artist_rated: "Artist Rated",
  venue_rated: "Venue Rated",
  artist_flagged: "Artist Flagged",
  venue_flagged: "Venue Flagged",
};

const rowColor = (action: string) => {
  if (["user_unblocked", "review_added", "dispute_resolved"].includes(action)) return "border-l-green-500 bg-green-50/40";
  if (["user_warned", "artist_flagged", "venue_flagged", "dispute_escalated", "booking_flagged"].includes(action)) return "border-l-accent bg-accent/5";
  if (["user_blocked"].includes(action)) return "border-l-destructive bg-destructive/5";
  if (["login", "admin_login", "admin_login_failed"].includes(action)) return "border-l-primary bg-primary/5";
  return "border-l-muted bg-muted/10";
};

const AdminAuditLog = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminMap, setAdminMap] = useState<Record<string, { name: string; avatar?: string }>>({});
  const perPage = 50;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("admin_actions_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      const list = data || [];
      setEntries(list);

      const ids = [...new Set(list.map(e => e.admin_id))];
      if (ids.length) {
        const { data: admins } = await supabase.from("admin_users").select("user_id, display_name").in("user_id", ids);
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids);
        const map: Record<string, { name: string; avatar?: string }> = {};
        (admins || []).forEach(a => { map[a.user_id] = { name: a.display_name || "Admin" }; });
        (profiles || []).forEach(p => { if (map[p.user_id]) map[p.user_id].avatar = p.avatar_url || undefined; else map[p.user_id] = { name: p.full_name || "Admin", avatar: p.avatar_url || undefined }; });
        setAdminMap(map);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = entries;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => {
        const adminName = adminMap[e.admin_id]?.name || "";
        return adminName.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) || JSON.stringify(e.details || {}).toLowerCase().includes(q);
      });
    }
    if (actionFilter !== "All") list = list.filter(e => e.action === actionFilter);
    if (dateRange.from) list = list.filter(e => new Date(e.created_at) >= dateRange.from!);
    if (dateRange.to) list = list.filter(e => new Date(e.created_at) <= dateRange.to!);
    return list;
  }, [entries, search, actionFilter, dateRange, adminMap]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  const exportCsv = () => {
    const header = "Timestamp,Admin,Action,Target Type,Target ID,IP,Details\n";
    const rows = filtered.map(e => `${e.created_at},"${adminMap[e.admin_id]?.name || ""}",${e.action},${e.target_type || ""},${e.target_id || ""},${e.ip_address || ""},"${JSON.stringify(e.details || {}).replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "audit_log_export.csv"; a.click();
  };

  const describeAction = (e: any) => {
    const details = e.details as any || {};
    const action = e.action.replace(/_/g, " ");
    if (details.email) return `${action} — ${details.email}`;
    if (details.target_name) return `${action} — ${details.target_name}`;
    if (details.resolution) return `${action}: ${details.resolution}`;
    return action.charAt(0).toUpperCase() + action.slice(1);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-[28px] font-display font-bold text-foreground">Admin Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete record of all admin actions on the platform</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2"><Download className="h-4 w-4" />Export CSV</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by admin name or action..." className="pl-9 h-10" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] h-10"><SelectValue /></SelectTrigger>
          <SelectContent>{ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>)}</SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 gap-2">
              <CalendarIcon className="h-4 w-4" />
              {dateRange.from ? `${format(dateRange.from, "dd MMM")}${dateRange.to ? ` – ${format(dateRange.to, "dd MMM")}` : ""}` : "Date Range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={dateRange as any} onSelect={(r: any) => { setDateRange(r || {}); setPage(0); }} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-xs text-muted-foreground">Showing {filtered.length} entries</p>

      {/* Entries */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : paged.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-card-border">No audit entries found</div>
      ) : (
        <div className="space-y-2">
          {paged.map(e => {
            const admin = adminMap[e.admin_id];
            const expanded = expandedId === e.id;
            return (
              <div key={e.id} className={cn("bg-card rounded-xl border border-card-border border-l-4 transition-colors", rowColor(e.action))}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : e.id)}>
                  {/* Timestamp */}
                  <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap w-[140px] shrink-0">
                    {format(new Date(e.created_at), "dd MMM yyyy HH:mm")}
                  </span>

                  {/* Admin avatar */}
                  {admin?.avatar ? (
                    <img src={admin.avatar} className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center text-xs font-bold text-primary">
                      {(admin?.name || "A").charAt(0)}
                    </div>
                  )}

                  {/* Admin name + action */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-semibold text-[13px] text-foreground">{admin?.name || "Admin"}</span>
                      <span className="text-sm text-foreground">{describeAction(e)}</span>
                    </div>
                    {e.target_type && (
                      <span className="text-[11px] text-muted-foreground">{e.target_type}{e.target_id ? `: ${e.target_id.slice(0, 8)}…` : ""}</span>
                    )}
                  </div>

                  {/* IP */}
                  {e.ip_address && <span className="text-[11px] text-muted-foreground hidden md:block">{e.ip_address}</span>}

                  {/* Expand */}
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>

                {expanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-card-border">
                    <pre className="bg-muted/30 rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify({ id: e.id, admin_id: e.admin_id, action: e.action, target_type: e.target_type, target_id: e.target_id, ip_address: e.ip_address, details: e.details, created_at: e.created_at }, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
    </div>
  );
};

export default AdminAuditLog;

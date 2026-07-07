import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ChevronDown, Eye, AlertTriangle, ShieldBan, Loader2, X,
  ChevronLeft, ChevronRight, Star, Download, ArrowUpDown,
} from "lucide-react";
import { format, subDays, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type UserRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  created_at: string;
  email?: string;
  role?: string;
  status?: string;
  rating?: number;
};

const PER_PAGE = 20;

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [joinedFilter, setJoinedFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<string>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [drawerUser, setDrawerUser] = useState<UserRow | null>(null);
  const [drawerData, setDrawerData] = useState<any>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  // Modals
  const [warnModal, setWarnModal] = useState<UserRow | null>(null);
  const [blockModal, setBlockModal] = useState<UserRow | null>(null);
  const [warnReason, setWarnReason] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [bulkWarnModal, setBulkWarnModal] = useState(false);
  const [bulkBlockModal, setBulkBlockModal] = useState(false);
  const [bulkReason, setBulkReason] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: blocked }, { data: artistProfiles }, { data: venueProfiles }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, avatar_url, city, created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("blocked_users").select("user_id, status").eq("status", "active"),
      supabase.from("artist_profiles").select("user_id, rating"),
      supabase.from("venue_profiles").select("user_id, rating"),
    ]);

    const roleMap = new Map<string, string>();
    roles?.forEach(r => roleMap.set(r.user_id, r.role));
    const blockedSet = new Set(blocked?.map(b => b.user_id) || []);
    const ratingMap = new Map<string, number>();
    artistProfiles?.forEach(a => { if (a.rating) ratingMap.set(a.user_id, Number(a.rating)); });
    venueProfiles?.forEach(v => { if (v.rating) ratingMap.set(v.user_id, Number(v.rating)); });

    const allCities = new Set<string>();
    const mapped: UserRow[] = (profiles || []).map(p => {
      if (p.city) allCities.add(p.city);
      const role = roleMap.get(p.user_id) || "user";
      const isBlocked = blockedSet.has(p.user_id);
      return {
        ...p,
        role,
        status: isBlocked ? "blocked" : "active",
        rating: ratingMap.get(p.user_id) || 0,
      };
    });
    setCities(Array.from(allCities).sort());
    setUsers(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Filter + search
  useEffect(() => {
    let result = [...users];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.city || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") result = result.filter(u => u.role === roleFilter);
    if (cityFilter !== "all") result = result.filter(u => u.city === cityFilter);
    if (statusFilter !== "all") result = result.filter(u => u.status === statusFilter);
    if (joinedFilter !== "all") {
      const now = new Date();
      let cutoff: Date;
      if (joinedFilter === "today") cutoff = startOfDay(now);
      else if (joinedFilter === "week") cutoff = startOfWeek(now, { weekStartsOn: 1 });
      else cutoff = startOfMonth(now);
      result = result.filter(u => new Date(u.created_at) >= cutoff);
    }
    // Sort
    result.sort((a: any, b: any) => {
      const va = a[sortCol] || "";
      const vb = b[sortCol] || "";
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    setFiltered(result);
    setPage(0);
  }, [users, search, roleFilter, cityFilter, statusFilter, joinedFilter, sortCol, sortAsc]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageUsers = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const toggleSelect = (uid: string) => {
    const s = new Set(selected);
    s.has(uid) ? s.delete(uid) : s.add(uid);
    setSelected(s);
  };
  const toggleAll = () => {
    if (selected.size === pageUsers.length) setSelected(new Set());
    else setSelected(new Set(pageUsers.map(u => u.user_id)));
  };

  const logAction = async (action: string, targetId: string, details?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("admin_actions_log").insert({
      admin_id: session.user.id,
      action,
      target_id: targetId,
      target_type: "user",
      details: { ...details, timestamp: new Date().toISOString() },
    });
  };

  // Drawer
  const openDrawer = async (u: UserRow) => {
    setDrawerUser(u);
    setDrawerLoading(true);
    const [{ count: bookingCount }, { data: warnings }, { data: blocks }, { data: reviews }] = await Promise.all([
      supabase.from("bookings").select("*", { count: "exact", head: true }),
      supabase.from("user_warnings").select("*").eq("user_id", u.user_id).order("created_at", { ascending: false }),
      supabase.from("blocked_users").select("*").eq("user_id", u.user_id).order("blocked_at", { ascending: false }),
      supabase.from("reviews").select("rating, comment, created_at").eq("reviewee_id", u.user_id).order("created_at", { ascending: false }).limit(5),
    ]);
    setDrawerData({ bookingCount: bookingCount || 0, warnings: warnings || [], blocks: blocks || [], reviews: reviews || [] });
    setDrawerLoading(false);
  };

  const handleWarn = async () => {
    if (!warnModal || !warnReason.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("user_warnings").insert({
      user_id: warnModal.user_id,
      warned_by: session.user.id,
      reason: warnReason,
      severity: "medium",
    });
    await logAction("warn_user", warnModal.user_id, { reason: warnReason });
    toast({ title: "Warning sent", description: `Warning issued to ${warnModal.full_name || "user"}.` });
    setWarnModal(null);
    setWarnReason("");
    fetchUsers();
  };

  const handleBlock = async () => {
    if (!blockModal || !blockReason.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("blocked_users").insert({
      user_id: blockModal.user_id,
      blocked_by: session.user.id,
      reason: blockReason,
    });
    await logAction("block_user", blockModal.user_id, { reason: blockReason });
    toast({ title: "User blocked", description: `${blockModal.full_name || "User"} has been blocked.`, variant: "destructive" });
    setBlockModal(null);
    setBlockReason("");
    fetchUsers();
  };

  const handleBulkWarn = async () => {
    if (!bulkReason.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const ids = Array.from(selected);
    await Promise.all(ids.map(uid =>
      supabase.from("user_warnings").insert({ user_id: uid, warned_by: session.user.id, reason: bulkReason, severity: "medium" })
    ));
    await Promise.all(ids.map(uid => logAction("bulk_warn_user", uid, { reason: bulkReason })));
    toast({ title: "Warnings sent", description: `Warning issued to ${ids.length} users.` });
    setBulkWarnModal(false);
    setBulkReason("");
    setSelected(new Set());
    fetchUsers();
  };

  const handleBulkBlock = async () => {
    if (!bulkReason.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const ids = Array.from(selected);
    await Promise.all(ids.map(uid =>
      supabase.from("blocked_users").insert({ user_id: uid, blocked_by: session.user.id, reason: bulkReason })
    ));
    await Promise.all(ids.map(uid => logAction("bulk_block_user", uid, { reason: bulkReason })));
    toast({ title: "Users blocked", description: `${ids.length} users have been blocked.`, variant: "destructive" });
    setBulkBlockModal(false);
    setBulkReason("");
    setSelected(new Set());
    fetchUsers();
  };

  const exportCSV = () => {
    const headers = ["Name", "Role", "City", "Status", "Joined", "Rating"];
    const rows = filtered.map(u => [
      u.full_name || "", u.role || "", u.city || "", u.status || "",
      format(new Date(u.created_at), "yyyy-MM-dd"), u.rating || 0,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "users_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const FilterDropdown = ({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  }) => (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none text-[13px] font-medium px-3 py-2 pr-8 rounded-lg border bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
        style={{ borderColor: "#E8E4F5", color: "#1A1033" }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "#7C6FAA" }} />
    </div>
  );

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <th
      className="text-left px-3 py-3 font-semibold text-[12px] uppercase tracking-wide cursor-pointer select-none hover:text-primary transition-colors"
      style={{ color: "#7C6FAA" }}
      onClick={() => toggleSort(col)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  );

  const roleBadge = (role: string) => {
    const isArtist = role === "artist";
    return (
      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{
        background: isArtist ? "#F5F3FF" : "#F0FDFA",
        color: isArtist ? "#7C5CBF" : "#0EA5A0",
      }}>{role === "artist" ? "Artist" : role === "venue" ? "Venue" : role}</span>
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      active: { bg: "#ECFDF5", color: "#059669" },
      blocked: { bg: "#FEF2F2", color: "#EF4444" },
      pending: { bg: "#FFF7ED", color: "#F4845F" },
    };
    const s = map[status] || map.active;
    return (
      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize" style={{ background: s.bg, color: s.color }}>
        {status}
      </span>
    );
  };

  const Modal = ({ open, title, onClose, onConfirm, confirmLabel, confirmColor, children }: {
    open: boolean; title: string; onClose: () => void; onConfirm: () => void;
    confirmLabel: string; confirmColor: string; children: React.ReactNode;
  }) => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-display font-bold mb-4" style={{ color: "#1A1033" }}>{title}</h3>
          {children}
          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border text-sm font-medium" style={{ borderColor: "#E8E4F5", color: "#7C6FAA" }}>Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: confirmColor }}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 min-h-screen" style={{ background: "#F5F3FF" }}>
      <h1 className="text-[28px] font-display font-bold mb-6" style={{ color: "#1A1033" }}>User Management</h1>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{ color: "#7C5CBF" }} />
        <input
          type="text"
          placeholder="Search by name, email, city, role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-12 pl-12 pr-4 rounded-xl border bg-white text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ borderColor: "#E8E4F5" }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <FilterDropdown label="Role" value={roleFilter} onChange={setRoleFilter} options={[
          { value: "all", label: "All Roles" }, { value: "artist", label: "Artist" }, { value: "venue", label: "Venue" },
        ]} />
        <FilterDropdown label="City" value={cityFilter} onChange={setCityFilter} options={[
          { value: "all", label: "All Cities" }, ...cities.map(c => ({ value: c, label: c })),
        ]} />
        <FilterDropdown label="Status" value={statusFilter} onChange={setStatusFilter} options={[
          { value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "blocked", label: "Blocked" },
        ]} />
        <FilterDropdown label="Joined" value={joinedFilter} onChange={setJoinedFilter} options={[
          { value: "all", label: "All Time" }, { value: "today", label: "Today" }, { value: "week", label: "This Week" }, { value: "month", label: "This Month" },
        ]} />
        <span className="ml-auto text-[13px] font-body" style={{ color: "#7C6FAA" }}>
          Showing {filtered.length} users
        </span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-white border" style={{ borderColor: "#E8E4F5" }}>
          <span className="text-sm font-semibold" style={{ color: "#1A1033" }}>{selected.size} users selected</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setBulkReason(""); setBulkWarnModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium" style={{ background: "#FFF7ED", color: "#F4845F" }}>
              <AlertTriangle className="h-3.5 w-3.5" /> Send Warning
            </button>
            <button onClick={() => { setBulkReason(""); setBulkBlockModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium" style={{ background: "#FEF2F2", color: "#EF4444" }}>
              <ShieldBan className="h-3.5 w-3.5" /> Block Selected
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium" style={{ background: "#F5F3FF", color: "#7C5CBF" }}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#E8E4F5" }}>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#7C5CBF" }} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: "#7C6FAA" }}>No users found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "#E8E4F5", background: "#FAFAFE" }}>
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox" checked={selected.size === pageUsers.length && pageUsers.length > 0} onChange={toggleAll} className="accent-[#7C5CBF] w-4 h-4 rounded" />
                    </th>
                    <th className="px-3 py-3 w-12" />
                    <SortHeader col="full_name">Name</SortHeader>
                    <SortHeader col="role">Role</SortHeader>
                    <SortHeader col="city">City</SortHeader>
                    <SortHeader col="created_at">Joined</SortHeader>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase tracking-wide" style={{ color: "#7C6FAA" }}>Status</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase tracking-wide" style={{ color: "#7C6FAA" }}>Rating</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase tracking-wide" style={{ color: "#7C6FAA" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageUsers.map((u, i) => (
                    <tr key={u.user_id} className="border-b last:border-0 transition-colors" style={{ borderColor: "#F5F3FF", background: i % 2 === 1 ? "#F5F3FF" : "white" }}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.has(u.user_id)} onChange={() => toggleSelect(u.user_id)} className="accent-[#7C5CBF] w-4 h-4 rounded" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-9 w-9 rounded-full bg-[#F5F3FF] flex items-center justify-center overflow-hidden">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[13px] font-semibold" style={{ color: "#7C5CBF" }}>{(u.full_name || "?")[0].toUpperCase()}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-display font-semibold text-[14px]" style={{ color: "#1A1033" }}>{u.full_name || "—"}</p>
                      </td>
                      <td className="px-3 py-3">{roleBadge(u.role || "user")}</td>
                      <td className="px-3 py-3" style={{ color: "#7C6FAA" }}>{u.city || "—"}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#7C6FAA" }}>{format(new Date(u.created_at), "MMM d, yyyy")}</td>
                      <td className="px-3 py-3">{statusBadge(u.status || "active")}</td>
                      <td className="px-3 py-3">
                        {u.rating && u.rating > 0 ? (
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-[#F4845F]" style={{ color: "#F4845F" }} />
                            <span className="text-[12px] font-semibold" style={{ color: "#F4845F" }}>{u.rating}</span>
                          </div>
                        ) : <span style={{ color: "#7C6FAA" }}>—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openDrawer(u)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#F5F3FF] transition-colors" title="View Profile">
                            <Eye className="h-4 w-4" style={{ color: "#7C5CBF" }} />
                          </button>
                          <button onClick={() => { setWarnReason(""); setWarnModal(u); }} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#FFF7ED] transition-colors" title="Warn User">
                            <AlertTriangle className="h-4 w-4" style={{ color: "#F4845F" }} />
                          </button>
                          <button onClick={() => { setBlockReason(""); setBlockModal(u); }} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#FEF2F2] transition-colors" title="Block User">
                            <ShieldBan className="h-4 w-4" style={{ color: "#EF4444" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "#E8E4F5" }}>
              <span className="text-[12px]" style={{ color: "#7C6FAA" }}>Page {page + 1} of {totalPages || 1}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[13px] font-medium disabled:opacity-40" style={{ borderColor: "#E8E4F5", color: "#7C5CBF" }}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[13px] font-medium disabled:opacity-40" style={{ borderColor: "#E8E4F5", color: "#7C5CBF" }}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drawer */}
      {drawerUser && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerUser(null)} />
          <div className="relative w-[400px] max-w-full bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E8E4F5" }}>
              <h3 className="font-display font-bold text-lg" style={{ color: "#1A1033" }}>User Details</h3>
              <button onClick={() => setDrawerUser(null)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#F5F3FF]">
                <X className="h-4 w-4" style={{ color: "#7C6FAA" }} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Profile header */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-[#F5F3FF] flex items-center justify-center overflow-hidden">
                  {drawerUser.avatar_url ? (
                    <img src={drawerUser.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold" style={{ color: "#7C5CBF" }}>{(drawerUser.full_name || "?")[0].toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="font-display font-bold text-lg" style={{ color: "#1A1033" }}>{drawerUser.full_name || "—"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {roleBadge(drawerUser.role || "user")}
                    {statusBadge(drawerUser.status || "active")}
                  </div>
                </div>
              </div>

              {/* Profile fields */}
              <div className="space-y-3">
                <Field label="City" value={drawerUser.city || "—"} />
                <Field label="User ID" value={drawerUser.user_id} mono />
                <Field label="Joined" value={format(new Date(drawerUser.created_at), "MMMM d, yyyy")} />
                <Field label="Rating" value={drawerUser.rating ? `${drawerUser.rating} ★` : "No reviews"} />
              </div>

              {drawerLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#7C5CBF" }} /></div>
              ) : drawerData && (
                <>
                  <Field label="Total Bookings" value={String(drawerData.bookingCount)} />

                  <Section title={`Warnings (${drawerData.warnings.length})`}>
                    {drawerData.warnings.length === 0 ? <p className="text-[13px]" style={{ color: "#7C6FAA" }}>No warnings</p> :
                      drawerData.warnings.map((w: any) => (
                        <div key={w.id} className="text-[13px] border-b pb-2 mb-2" style={{ borderColor: "#F5F3FF" }}>
                          <p style={{ color: "#1A1033" }}>{w.reason}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "#7C6FAA" }}>{format(new Date(w.created_at), "MMM d, yyyy")} · {w.severity}</p>
                        </div>
                      ))
                    }
                  </Section>

                  <Section title={`Block History (${drawerData.blocks.length})`}>
                    {drawerData.blocks.length === 0 ? <p className="text-[13px]" style={{ color: "#7C6FAA" }}>Never blocked</p> :
                      drawerData.blocks.map((b: any) => (
                        <div key={b.id} className="text-[13px] border-b pb-2 mb-2" style={{ borderColor: "#F5F3FF" }}>
                          <p style={{ color: "#1A1033" }}>{b.reason}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "#7C6FAA" }}>{format(new Date(b.blocked_at), "MMM d, yyyy")} · {b.status}</p>
                        </div>
                      ))
                    }
                  </Section>

                  <Section title={`Reviews (${drawerData.reviews.length})`}>
                    {drawerData.reviews.length === 0 ? <p className="text-[13px]" style={{ color: "#7C6FAA" }}>No reviews</p> :
                      drawerData.reviews.map((r: any, i: number) => (
                        <div key={i} className="text-[13px] border-b pb-2 mb-2" style={{ borderColor: "#F5F3FF" }}>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-[#F4845F]" style={{ color: "#F4845F" }} />
                            <span className="font-semibold" style={{ color: "#F4845F" }}>{r.rating}</span>
                          </div>
                          {r.comment && <p className="mt-1" style={{ color: "#1A1033" }}>{r.comment}</p>}
                          <p className="text-[11px] mt-0.5" style={{ color: "#7C6FAA" }}>{format(new Date(r.created_at), "MMM d, yyyy")}</p>
                        </div>
                      ))
                    }
                  </Section>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warn Modal */}
      <Modal open={!!warnModal} title={`Warn ${warnModal?.full_name || "User"}`} onClose={() => setWarnModal(null)} onConfirm={handleWarn} confirmLabel="Send Warning" confirmColor="#F4845F">
        <textarea value={warnReason} onChange={e => setWarnReason(e.target.value)} placeholder="Reason for warning..." className="w-full h-24 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5" }} />
      </Modal>

      <Modal open={!!blockModal} title={`Block ${blockModal?.full_name || "User"}`} onClose={() => setBlockModal(null)} onConfirm={handleBlock} confirmLabel="Block User" confirmColor="#EF4444">
        <textarea value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Reason for blocking..." className="w-full h-24 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5" }} />
      </Modal>

      <Modal open={bulkWarnModal} title={`Warn ${selected.size} Users`} onClose={() => setBulkWarnModal(false)} onConfirm={handleBulkWarn} confirmLabel="Send Warnings" confirmColor="#F4845F">
        <textarea value={bulkReason} onChange={e => setBulkReason(e.target.value)} placeholder="Reason for warning..." className="w-full h-24 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5" }} />
      </Modal>

      <Modal open={bulkBlockModal} title={`Block ${selected.size} Users`} onClose={() => setBulkBlockModal(false)} onConfirm={handleBulkBlock} confirmLabel="Block All" confirmColor="#EF4444">
        <textarea value={bulkReason} onChange={e => setBulkReason(e.target.value)} placeholder="Reason for blocking..." className="w-full h-24 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5" }} />
      </Modal>
    </div>
  );
};

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#7C6FAA" }}>{label}</p>
    <p className={`text-[14px] ${mono ? "font-mono text-[12px]" : ""}`} style={{ color: "#1A1033" }}>{value}</p>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h4 className="text-[13px] font-display font-semibold mb-2" style={{ color: "#1A1033" }}>{title}</h4>
    {children}
  </div>
);

export default AdminUsers;

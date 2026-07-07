import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldBan, AlertTriangle, Search, Eye, Loader2, X, Plus, Check, XCircle,
  ChevronDown, ChevronRight, Mail,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type BlockRow = any;
type WarnRow = any;
type ProfileMap = Record<string, { full_name: string | null; avatar_url: string | null; city: string | null }>;
type RoleMap = Record<string, string>;

const WARNING_TYPES = ["Poor Performance", "Payment Dispute", "Inappropriate Behaviour", "Fake Profile", "Spam", "No-Show", "Other"];
const SEVERITIES = ["Minor Warning", "Serious Warning", "Final Warning", "Temporary Block", "Permanent Block"];
const DURATIONS = [
  { value: "7", label: "7 days" }, { value: "14", label: "14 days" },
  { value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "custom", label: "Custom" },
];

const AdminBlocksWarnings = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"blocks" | "warnings" | "appeals">("blocks");
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [warnings, setWarnings] = useState<WarnRow[]>([]);
  const [appeals, setAppeals] = useState<BlockRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [roles, setRoles] = useState<RoleMap>({});
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Modal state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [actionType, setActionType] = useState<"warning" | "block">("warning");
  const [warningType, setWarningType] = useState(WARNING_TYPES[0]);
  const [severity, setSeverity] = useState(SEVERITIES[0]);
  const [duration, setDuration] = useState("30");
  const [customDays, setCustomDays] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);

  // Warning counts per user
  const [warningCounts, setWarningCounts] = useState<Record<string, number>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: blockData }, { data: warnData }, { data: profileData }, { data: roleData }] = await Promise.all([
      supabase.from("blocked_users").select("*").order("blocked_at", { ascending: false }),
      supabase.from("user_warnings").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, avatar_url, city"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const pMap: ProfileMap = {};
    (profileData || []).forEach(p => { pMap[p.user_id] = p; });
    setProfiles(pMap);

    const rMap: RoleMap = {};
    (roleData || []).forEach(r => { rMap[r.user_id] = r.role; });
    setRoles(rMap);

    const activeBlocks = (blockData || []).filter(b => b.status === "active");
    const appealRequests = (blockData || []).filter(b => b.appeal_message && b.appeal_status === "pending");
    setBlocks(activeBlocks);
    setAppeals(appealRequests);
    setWarnings(warnData || []);

    // Count warnings per user
    const counts: Record<string, number> = {};
    (warnData || []).forEach(w => { counts[w.user_id] = (counts[w.user_id] || 0) + 1; });
    setWarningCounts(counts);

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const logAction = async (action: string, targetId: string, details?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("admin_actions_log").insert({
      admin_id: session.user.id, action, target_id: targetId, target_type: "user",
      details: { ...details, timestamp: new Date().toISOString() },
    });
  };

  const handleUnblock = async (block: BlockRow) => {
    await supabase.from("blocked_users").update({ status: "unblocked", unblocked_at: new Date().toISOString() }).eq("id", block.id);
    await logAction("unblock_user", block.user_id, { reason: "Admin unblocked" });
    toast({ title: "User unblocked", description: `${profiles[block.user_id]?.full_name || "User"} has been unblocked.` });
    fetchData();
  };

  const handleAppeal = async (block: BlockRow, approved: boolean) => {
    if (approved) {
      await supabase.from("blocked_users").update({ status: "unblocked", unblocked_at: new Date().toISOString(), appeal_status: "approved" }).eq("id", block.id);
      await logAction("approve_appeal", block.user_id, { block_id: block.id });
      toast({ title: "Appeal approved", description: "User has been unblocked." });
    } else {
      await supabase.from("blocked_users").update({ appeal_status: "rejected" }).eq("id", block.id);
      await logAction("reject_appeal", block.user_id, { block_id: block.id });
      toast({ title: "Appeal rejected", description: "Block remains active.", variant: "destructive" });
    }
    fetchData();
  };

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url, city").ilike("full_name", `%${q}%`).limit(10);
    setSearchResults(data || []);
  };

  const handleSave = async () => {
    if (!selectedUser || !reason.trim()) {
      toast({ title: "Missing fields", description: "Please select a user and provide a reason.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

    const isBlock = actionType === "block" || severity === "Temporary Block" || severity === "Permanent Block";

    if (isBlock) {
      const blockType = severity === "Temporary Block" ? "temporary" : "permanent";
      let blockEnd = null;
      if (blockType === "temporary") {
        const days = duration === "custom" ? parseInt(customDays) || 30 : parseInt(duration);
        blockEnd = new Date(Date.now() + days * 86400000).toISOString();
      }
      await supabase.from("blocked_users").insert({
        user_id: selectedUser.user_id, blocked_by: session.user.id, reason,
        block_type: blockType, block_end_date: blockEnd, evidence_notes: evidence,
      });
      await logAction("block_user", selectedUser.user_id, { reason, severity, block_type: blockType });
      toast({ title: "User blocked", description: `${selectedUser.full_name || "User"} has been blocked.`, variant: "destructive" });
    } else {
      await supabase.from("user_warnings").insert({
        user_id: selectedUser.user_id, warned_by: session.user.id, reason,
        severity: severity.toLowerCase().replace(/ /g, "_"),
        warning_type: warningType.toLowerCase().replace(/ /g, "_"),
        warning_count: (warningCounts[selectedUser.user_id] || 0) + 1,
      });
      await logAction("warn_user", selectedUser.user_id, { reason, severity, warning_type: warningType });
      toast({ title: "Warning issued", description: `Warning sent to ${selectedUser.full_name || "user"}.` });
    }

    setSaving(false);
    setShowModal(false);
    setSelectedUser(null);
    setReason("");
    setEvidence("");
    setSearchQuery("");
    fetchData();
  };

  const getName = (uid: string) => profiles[uid]?.full_name || "Unknown";
  const getAvatar = (uid: string) => profiles[uid]?.avatar_url;

  const Avatar = ({ uid, size = 36 }: { uid: string; size?: number }) => (
    <div className="rounded-full bg-[#F5F3FF] flex items-center justify-center overflow-hidden shrink-0" style={{ width: size, height: size }}>
      {getAvatar(uid) ? <img src={getAvatar(uid)!} alt="" className="h-full w-full object-cover" /> :
        <span className="text-xs font-bold" style={{ color: "#7C5CBF" }}>{(getName(uid))[0]?.toUpperCase()}</span>}
    </div>
  );

  const RoleBadge = ({ uid }: { uid: string }) => {
    const role = roles[uid] || "user";
    const isArtist = role === "artist";
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: isArtist ? "#F5F3FF" : "#F0FDFA", color: isArtist ? "#7C5CBF" : "#0EA5A0" }}>{role}</span>;
  };

  const TabBtn = ({ id, label, count, color }: { id: string; label: string; count: number; color: string }) => (
    <button onClick={() => setTab(id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-medium transition-all ${tab === id ? "bg-white shadow-sm" : "hover:bg-white/50"}`} style={{ color: tab === id ? "#1A1033" : "#7C6FAA" }}>
      {label}
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{count}</span>
    </button>
  );

  return (
    <div className="p-6 lg:p-8 min-h-screen" style={{ background: "#F5F3FF" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldBan className="h-7 w-7" style={{ color: "#EF4444" }} />
          <h1 className="text-[28px] font-display font-bold" style={{ color: "#1A1033" }}>Block & Warnings</h1>
        </div>
        <button onClick={() => { setShowModal(true); setSelectedUser(null); setReason(""); setEvidence(""); setSearchQuery(""); setActionType("warning"); setSeverity(SEVERITIES[0]); setWarningType(WARNING_TYPES[0]); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold" style={{ background: "#F4845F" }}>
          <Plus className="h-4 w-4" /> Issue Warning or Block
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: "#E8E4F5" }}>
        <TabBtn id="blocks" label="Active Blocks" count={blocks.length} color="#EF4444" />
        <TabBtn id="warnings" label="Warnings Issued" count={warnings.length} color="#F4845F" />
        <TabBtn id="appeals" label="Appeal Requests" count={appeals.length} color="#7C5CBF" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#7C5CBF" }} /></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#E8E4F5" }}>
          {/* Active Blocks Tab */}
          {tab === "blocks" && (
            blocks.length === 0 ? <p className="text-center py-16 text-sm" style={{ color: "#7C6FAA" }}>No active blocks.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead><tr className="border-b" style={{ borderColor: "#E8E4F5", background: "#FAFAFE" }}>
                    <th className="w-8" /><th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>User</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Role</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>City</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Reason</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Blocked By</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Blocked On</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Duration</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {blocks.map((b, i) => (
                      <>
                        <tr key={b.id} className="border-b cursor-pointer" style={{ borderColor: "#F5F3FF", background: i % 2 === 1 ? "#F5F3FF" : "white" }} onClick={() => setExpandedRow(expandedRow === b.id ? null : b.id)}>
                          <td className="px-2 py-3">{expandedRow === b.id ? <ChevronDown className="h-3.5 w-3.5" style={{ color: "#7C6FAA" }} /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: "#7C6FAA" }} />}</td>
                          <td className="px-3 py-3"><div className="flex items-center gap-2.5"><Avatar uid={b.user_id} /><span className="font-semibold" style={{ color: "#1A1033" }}>{getName(b.user_id)}</span></div></td>
                          <td className="px-3 py-3"><RoleBadge uid={b.user_id} /></td>
                          <td className="px-3 py-3" style={{ color: "#7C6FAA" }}>{profiles[b.user_id]?.city || "—"}</td>
                          <td className="px-3 py-3 max-w-[200px] truncate" style={{ color: "#1A1033" }}>{b.reason}</td>
                          <td className="px-3 py-3" style={{ color: "#7C6FAA" }}>{getName(b.blocked_by)}</td>
                          <td className="px-3 py-3 text-[12px]" style={{ color: "#7C6FAA" }}>{format(new Date(b.blocked_at), "MMM d, yyyy")}</td>
                          <td className="px-3 py-3">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${b.block_type === "permanent" ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"}`}>
                              {b.block_type === "permanent" ? "Permanent" : `Until ${b.block_end_date ? format(new Date(b.block_end_date), "MMM d") : "—"}`}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                              <button onClick={() => handleUnblock(b)} className="h-8 px-3 rounded-lg text-[12px] font-semibold flex items-center gap-1" style={{ background: "#ECFDF5", color: "#059669" }}>
                                <Check className="h-3.5 w-3.5" /> Unblock
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedRow === b.id && (
                          <tr key={b.id + "-exp"} style={{ background: "#FAFAFE" }}>
                            <td colSpan={9} className="px-6 py-4 border-b" style={{ borderColor: "#E8E4F5" }}>
                              <div className="space-y-2 text-[13px]">
                                <p><span className="font-semibold" style={{ color: "#1A1033" }}>Full Reason:</span> <span style={{ color: "#7C6FAA" }}>{b.reason}</span></p>
                                {b.evidence_notes && <p><span className="font-semibold" style={{ color: "#1A1033" }}>Evidence:</span> <span style={{ color: "#7C6FAA" }}>{b.evidence_notes}</span></p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Warnings Tab */}
          {tab === "warnings" && (
            warnings.length === 0 ? <p className="text-center py-16 text-sm" style={{ color: "#7C6FAA" }}>No warnings issued.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead><tr className="border-b" style={{ borderColor: "#E8E4F5", background: "#FAFAFE" }}>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>User</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Role</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Type</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Message</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Warned By</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Date</th>
                    <th className="text-left px-3 py-3 font-semibold text-[12px] uppercase" style={{ color: "#7C6FAA" }}>Count</th>
                  </tr></thead>
                  <tbody>
                    {warnings.map((w, i) => {
                      const count = warningCounts[w.user_id] || 1;
                      return (
                        <tr key={w.id} className="border-b" style={{ borderColor: "#F5F3FF", background: i % 2 === 1 ? "#F5F3FF" : "white" }}>
                          <td className="px-3 py-3"><div className="flex items-center gap-2.5"><Avatar uid={w.user_id} /><span className="font-semibold" style={{ color: "#1A1033" }}>{getName(w.user_id)}</span></div></td>
                          <td className="px-3 py-3"><RoleBadge uid={w.user_id} /></td>
                          <td className="px-3 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize" style={{ background: "#FFF7ED", color: "#F4845F" }}>{(w.warning_type || "other").replace(/_/g, " ")}</span></td>
                          <td className="px-3 py-3 max-w-[200px] truncate" style={{ color: "#1A1033" }}>{w.reason}</td>
                          <td className="px-3 py-3" style={{ color: "#7C6FAA" }}>{getName(w.warned_by)}</td>
                          <td className="px-3 py-3 text-[12px]" style={{ color: "#7C6FAA" }}>{format(new Date(w.created_at), "MMM d, yyyy")}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold" style={{ color: count >= 3 ? "#EF4444" : "#1A1033" }}>{count}</span>
                              {count >= 3 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600">Auto-Block Eligible</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Appeals Tab */}
          {tab === "appeals" && (
            appeals.length === 0 ? <p className="text-center py-16 text-sm" style={{ color: "#7C6FAA" }}>No pending appeals.</p> : (
              <div className="divide-y" style={{ borderColor: "#E8E4F5" }}>
                {appeals.map(a => (
                  <div key={a.id} className="p-5">
                    <div className="flex items-start gap-4">
                      <Avatar uid={a.user_id} size={48} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-display font-semibold" style={{ color: "#1A1033" }}>{getName(a.user_id)}</span>
                          <RoleBadge uid={a.user_id} />
                        </div>
                        <div className="space-y-2 text-[13px]">
                          <p><span className="font-semibold" style={{ color: "#7C6FAA" }}>Block Reason:</span> <span style={{ color: "#1A1033" }}>{a.reason}</span></p>
                          <p><span className="font-semibold" style={{ color: "#7C6FAA" }}>Appeal Message:</span> <span style={{ color: "#1A1033" }}>{a.appeal_message}</span></p>
                          <p className="text-[12px]" style={{ color: "#7C6FAA" }}>Blocked on {format(new Date(a.blocked_at), "MMM d, yyyy")} by {getName(a.blocked_by)}</p>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleAppeal(a, true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white" style={{ background: "#059669" }}>
                            <Check className="h-3.5 w-3.5" /> Approve Appeal
                          </button>
                          <button onClick={() => handleAppeal(a, false)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white" style={{ background: "#EF4444" }}>
                            <XCircle className="h-3.5 w-3.5" /> Reject Appeal
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Issue Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b rounded-t-xl" style={{ borderColor: "#E8E4F5" }}>
              <h3 className="font-display font-bold text-lg" style={{ color: "#1A1033" }}>Issue Warning or Block</h3>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#F5F3FF]">
                <X className="h-4 w-4" style={{ color: "#7C6FAA" }} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* User Search */}
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A1033" }}>Find User</label>
                {selectedUser ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: "#E8E4F5" }}>
                    <Avatar uid={selectedUser.user_id} />
                    <span className="font-semibold text-sm" style={{ color: "#1A1033" }}>{selectedUser.full_name}</span>
                    <button onClick={() => setSelectedUser(null)} className="ml-auto"><X className="h-4 w-4" style={{ color: "#7C6FAA" }} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#7C6FAA" }} />
                    <input type="text" placeholder="Search by name..." value={searchQuery} onChange={e => searchUsers(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5" }} />
                    {searchResults.length > 0 && (
                      <div className="absolute top-full mt-1 w-full bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto" style={{ borderColor: "#E8E4F5" }}>
                        {searchResults.map(u => (
                          <button key={u.user_id} onClick={() => { setSelectedUser(u); setSearchResults([]); setSearchQuery(""); }}
                            className="flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-[#F5F3FF] text-left text-sm">
                            <Avatar uid={u.user_id} size={28} />
                            <span style={{ color: "#1A1033" }}>{u.full_name}</span>
                            <span className="text-[11px] ml-auto" style={{ color: "#7C6FAA" }}>{u.city}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Type Toggle */}
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A1033" }}>Action Type</label>
                <div className="flex gap-2">
                  {(["warning", "block"] as const).map(t => (
                    <button key={t} onClick={() => setActionType(t)}
                      className="flex-1 py-2.5 rounded-lg border text-[13px] font-medium capitalize transition-all"
                      style={{
                        borderColor: actionType === t ? (t === "block" ? "#EF4444" : "#F4845F") : "#E8E4F5",
                        background: actionType === t ? (t === "block" ? "#FEF2F2" : "#FFF7ED") : "white",
                        color: actionType === t ? (t === "block" ? "#EF4444" : "#F4845F") : "#7C6FAA",
                      }}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Warning Type */}
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A1033" }}>Warning Type</label>
                <div className="relative">
                  <select value={warningType} onChange={e => setWarningType(e.target.value)} className="appearance-none w-full h-10 px-3 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5" }}>
                    {WARNING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "#7C6FAA" }} />
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A1033" }}>Severity</label>
                <div className="relative">
                  <select value={severity} onChange={e => setSeverity(e.target.value)} className="appearance-none w-full h-10 px-3 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5" }}>
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "#7C6FAA" }} />
                </div>
              </div>

              {/* Duration (only for Temporary Block) */}
              {(severity === "Temporary Block" || (actionType === "block" && severity !== "Permanent Block")) && (
                <div>
                  <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A1033" }}>Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map(d => (
                      <button key={d.value} onClick={() => setDuration(d.value)}
                        className="px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all"
                        style={{ borderColor: duration === d.value ? "#7C5CBF" : "#E8E4F5", background: duration === d.value ? "#F5F3FF" : "white", color: duration === d.value ? "#7C5CBF" : "#7C6FAA" }}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {duration === "custom" && (
                    <input type="number" placeholder="Number of days" value={customDays} onChange={e => setCustomDays(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5" }} />
                  )}
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A1033" }}>Reason <span style={{ color: "#EF4444" }}>*</span></label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the reason for this action..."
                  className="w-full rounded-lg border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5", height: 120 }} />
              </div>

              {/* Evidence */}
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A1033" }}>Evidence Notes <span className="font-normal" style={{ color: "#7C6FAA" }}>(optional)</span></label>
                <textarea value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Add any supporting evidence..."
                  className="w-full rounded-lg border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5", height: 80 }} />
              </div>

              {/* Email Toggle */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" style={{ color: "#7C6FAA" }} />
                  <span className="text-[13px] font-medium" style={{ color: "#1A1033" }}>Send Email Notification</span>
                </div>
                <button onClick={() => setSendEmail(!sendEmail)}
                  className="w-10 h-5.5 rounded-full transition-colors relative" style={{ background: sendEmail ? "#7C5CBF" : "#E8E4F5" }}>
                  <div className="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform" style={{ left: sendEmail ? 20 : 2 }} />
                </button>
              </div>

              {/* Save */}
              <button onClick={handleSave} disabled={saving}
                className="w-full py-3 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: "#F4845F" }}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {actionType === "block" ? "Block User" : "Issue Warning"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBlocksWarnings;

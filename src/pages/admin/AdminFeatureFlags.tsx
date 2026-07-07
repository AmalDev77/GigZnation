import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const DEFAULT_FLAGS = [
  { key: "enable_registrations", label: "Enable New User Registrations", desc: "Turn off during maintenance windows", scope: "All Users" },
  { key: "enable_artist_applications", label: "Enable Artist Applications on Gig Board", desc: "Allow artists to apply to open gigs", scope: "Artists Only" },
  { key: "enable_payments", label: "Enable Payment Processing", desc: "Process payments through the platform", scope: "All Users" },
  { key: "enable_messaging", label: "Enable In-App Messaging", desc: "Real-time chat between artists and venues", scope: "All Users" },
  { key: "enable_push_notifications", label: "Enable Push Notifications", desc: "Send push notifications to mobile users", scope: "All Users" },
  { key: "enable_admin_reviews_visible", label: "Enable Admin Reviews Visible on Profiles", desc: "Show GigZnation verified reviews publicly", scope: "All Users" },
  { key: "enable_review_system", label: "Enable Review and Rating System", desc: "Allow users to leave reviews after bookings", scope: "All Users" },
  { key: "maintenance_mode", label: "Maintenance Mode", desc: "Shows a maintenance page to all regular users", scope: "All Users" },
  { key: "enable_beta_features", label: "Enable Beta Features", desc: "Unlock experimental features for testing", scope: "All Users" },
  { key: "enable_gig_posting", label: "Enable New Gig Posting by Venues", desc: "Allow venues to post new gig listings", scope: "Venues Only" },
];

type Flag = { id: string; key: string; label: string; enabled: boolean; updated_at: string; updated_by: string | null };

const AdminFeatureFlags = () => {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmFlag, setConfirmFlag] = useState<{ flag: Flag; newState: boolean } | null>(null);
  const [acting, setActing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newScope, setNewScope] = useState("All Users");
  const [newDefault, setNewDefault] = useState(true);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("feature_flags").select("*").order("label");
    const list = (data as Flag[]) || [];
    setFlags(list);

    const adminIds = [...new Set(list.filter(f => f.updated_by).map(f => f.updated_by!))];
    if (adminIds.length) {
      const { data: admins } = await supabase.from("admin_users").select("user_id, display_name").in("user_id", adminIds);
      const map: Record<string, string> = {};
      (admins || []).forEach(a => { map[a.user_id] = a.display_name || "Admin"; });
      setAdminNames(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      // Seed default flags if table is empty
      const { data: existing } = await supabase.from("feature_flags").select("key");
      const existingKeys = new Set((existing || []).map(e => e.key));
      const missing = DEFAULT_FLAGS.filter(f => !existingKeys.has(f.key));
      if (missing.length) {
        await supabase.from("feature_flags").insert(missing.map(f => ({ key: f.key, label: f.label, enabled: true })));
      }
      load();
    };
    init();
  }, []);

  const getDesc = (key: string) => DEFAULT_FLAGS.find(f => f.key === key)?.desc || "";
  const getScope = (key: string) => DEFAULT_FLAGS.find(f => f.key === key)?.scope || "All Users";

  const confirmToggle = async () => {
    if (!confirmFlag) return;
    setActing(true);
    const { flag, newState } = confirmFlag;
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("feature_flags").update({
      enabled: newState,
      updated_at: new Date().toISOString(),
      updated_by: session!.user.id,
    }).eq("id", flag.id);

    await supabase.from("admin_actions_log").insert({
      admin_id: session!.user.id,
      action: "feature_flag_changed",
      target_type: "feature_flag",
      target_id: flag.id,
      details: { flag: flag.label, key: flag.key, from: flag.enabled, to: newState },
    });

    toast.success(`${flag.label} ${newState ? "enabled" : "disabled"}`);
    setActing(false);
    setConfirmFlag(null);
    load();
  };

  const addFlag = async () => {
    if (!newName.trim()) { toast.error("Flag name is required"); return; }
    setActing(true);
    const key = newName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("feature_flags").insert({ key, label: newName.trim(), enabled: newDefault });
    await supabase.from("admin_actions_log").insert({
      admin_id: session!.user.id,
      action: "feature_flag_created",
      target_type: "feature_flag",
      details: { flag: newName.trim(), key, scope: newScope, default: newDefault },
    });
    toast.success("Flag created");
    setActing(false);
    setShowAdd(false);
    setNewName("");
    setNewDesc("");
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-[28px] font-display font-bold text-foreground">Feature Flags</h1>
          <p className="text-sm text-muted-foreground mt-1">Control platform features without redeploying</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 bg-primary hover:bg-primary/90"><Plus className="h-4 w-4" />Add New Flag</Button>
      </div>

      {/* Warning banner */}
      <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-xl px-5 py-3">
        <AlertTriangle className="h-5 w-5 text-accent shrink-0" />
        <p className="text-sm text-accent font-medium">Changes to feature flags take effect immediately for all users. Be careful.</p>
      </div>

      {/* Flag cards */}
      <div className="space-y-3">
        {flags.map(f => {
          const desc = getDesc(f.key);
          const scope = getScope(f.key);
          const scopeColor = scope === "Artists Only" ? "bg-primary/10 text-primary" : scope === "Venues Only" ? "bg-teal-100 text-teal-700" : "bg-muted text-muted-foreground";
          return (
            <div key={f.id} className="bg-card rounded-xl border border-card-border px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display font-semibold text-base text-foreground">{f.label}</p>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", scopeColor)}>{scope}</span>
                </div>
                {desc && <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-mono">{f.key}</span>
                  {f.updated_by && <span> · Last changed {format(new Date(f.updated_at), "dd MMM yyyy")} by {adminNames[f.updated_by] || "Admin"}</span>}
                </p>
              </div>
              <Switch
                checked={f.enabled}
                onCheckedChange={v => setConfirmFlag({ flag: f, newState: v })}
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30 scale-125"
              />
            </div>
          );
        })}
      </div>

      {/* Confirm toggle modal */}
      <Dialog open={!!confirmFlag} onOpenChange={o => !o && setConfirmFlag(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Feature Flag Change</DialogTitle>
          </DialogHeader>
          {confirmFlag && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-foreground">
                Are you sure you want to turn <strong>{confirmFlag.flag.label}</strong> <strong>{confirmFlag.newState ? "ON" : "OFF"}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">This will affect all users immediately.</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmFlag(null)} disabled={acting}>Cancel</Button>
            <Button onClick={confirmToggle} disabled={acting} className={cn(confirmFlag?.newState ? "bg-primary" : "bg-destructive", "text-white gap-1")}>
              {acting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add new flag modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create New Feature Flag</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Flag Name</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Enable Artist Portfolio" className="h-10" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What this flag controls..." className="min-h-[60px] resize-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Affected Users</label>
              <Select value={newScope} onValueChange={setNewScope}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Users">All Users</SelectItem>
                  <SelectItem value="Artists Only">Artists Only</SelectItem>
                  <SelectItem value="Venues Only">Venues Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Default State</span>
              <Switch checked={newDefault} onCheckedChange={setNewDefault} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addFlag} disabled={acting} className="gap-1">
              {acting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFeatureFlags;

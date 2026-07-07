import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload, Trash2, Plus, Shield } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<any>(null);

  // My Account
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Platform Settings
  const [commission, setCommission] = useState("10");
  const [minBooking, setMinBooking] = useState("500");
  const [maxBooking, setMaxBooking] = useState("500000");
  const [autoBlockWarnings, setAutoBlockWarnings] = useState("3");
  const [reviewWindow, setReviewWindow] = useState("48");
  const [cancellationPolicy, setCancellationPolicy] = useState("Bookings can be cancelled up to 24 hours before the event. Late cancellations may incur a fee.");
  const [supportEmail, setSupportEmail] = useState("info@gigznation.com");
  const [supportPhone, setSupportPhone] = useState("+91 9876543210");

  // Notification toggles
  const [notifDispute, setNotifDispute] = useState(true);
  const [notifVerification, setNotifVerification] = useState(true);
  const [notifAppeal, setNotifAppeal] = useState(true);
  const [notifHighValue, setNotifHighValue] = useState(true);
  const [notifSuspicious, setNotifSuspicious] = useState(true);

  // Manage Admins
  const [admins, setAdmins] = useState<any[]>([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("moderator");
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Password re-confirm for dangerous actions
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [pwConfirmValue, setPwConfirmValue] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      if (s) {
        setEmail(s.user.email || "");
        const { data: admin } = await supabase.from("admin_users").select("*").eq("user_id", s.user.id).maybeSingle();
        if (admin) {
          setDisplayName(admin.display_name || "");
        }
        const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("user_id", s.user.id).maybeSingle();
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
      }

      // Load admins
      const { data: adminList } = await supabase.from("admin_users").select("*").order("created_at");
      setAdmins(adminList || []);

      setLoading(false);
    })();
  }, []);

  const logAction = async (action: string, details: any = {}) => {
    if (!session) return;
    await supabase.from("admin_actions_log").insert({
      admin_id: session.user.id,
      action,
      target_type: "settings",
      details,
    });
  };

  const saveAccount = async () => {
    setSaving(true);
    await supabase.from("admin_users").update({ display_name: displayName }).eq("user_id", session.user.id);
    await logAction("settings_updated", { section: "account", display_name: displayName });
    toast.success("Account updated");
    setSaving(false);
  };

  const changePassword = async () => {
    if (!newPw || newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    if (newPw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { toast.error(error.message); } else {
      toast.success("Password changed");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      await logAction("password_changed", {});
    }
    setSaving(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `admin-avatars/${session.user.id}-${Date.now()}`;
    const { error } = await supabase.storage.from("artist-media").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    const { data: { publicUrl } } = supabase.storage.from("artist-media").getPublicUrl(path);
    setAvatarUrl(publicUrl);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", session.user.id);
    toast.success("Avatar updated");
  };

  const requirePwConfirm = (action: () => Promise<void>) => {
    setPendingAction(() => action);
    setPwConfirmValue("");
    setShowPwConfirm(true);
  };

  const executePwConfirm = async () => {
    if (!pwConfirmValue) { toast.error("Enter your password"); return; }
    setSaving(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwConfirmValue });
    if (error) { toast.error("Incorrect password"); setSaving(false); return; }
    if (pendingAction) await pendingAction();
    setShowPwConfirm(false);
    setPendingAction(null);
    setSaving(false);
  };

  const savePlatformSettings = async () => {
    await logAction("platform_settings_updated", { commission, minBooking, maxBooking, autoBlockWarnings, reviewWindow, supportEmail, supportPhone });
    toast.success("Platform settings saved");
  };

  const saveNotifSettings = async () => {
    await logAction("notification_settings_updated", { notifDispute, notifVerification, notifAppeal, notifHighValue, notifSuspicious });
    toast.success("Notification settings saved");
  };

  const removeAdmin = async (adminId: string, userId: string) => {
    if (userId === session?.user.id) { toast.error("Cannot remove yourself"); return; }
    await supabase.from("admin_users").delete().eq("id", adminId);
    await logAction("admin_removed", { removed_admin_id: userId });
    setAdmins(prev => prev.filter(a => a.id !== adminId));
    toast.success("Admin removed");
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) { toast.error("Email required"); return; }
    setAddingAdmin(true);
    // We insert a placeholder — the actual user must exist
    await supabase.from("admin_users").insert({
      user_id: crypto.randomUUID(), // placeholder
      display_name: newAdminEmail.trim(),
      permissions: { role: newAdminRole },
    });
    await logAction("admin_added", { email: newAdminEmail, role: newAdminRole });
    toast.success("Admin invitation created");
    setAddingAdmin(false);
    setShowAddAdmin(false);
    setNewAdminEmail("");
    const { data } = await supabase.from("admin_users").select("*").order("created_at");
    setAdmins(data || []);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-card rounded-xl border border-card-border p-6 space-y-4">
      <h2 className="text-lg font-display font-bold text-foreground">{title}</h2>
      {children}
    </div>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">{label}</label>
      {children}
    </div>
  );

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl md:text-[28px] font-display font-bold text-foreground">Admin Settings</h1>

      {/* My Account */}
      <Section title="My Account">
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">{(displayName || "A").charAt(0)}</div>
            )}
            <label className="absolute -bottom-1 -right-1 bg-card border border-card-border rounded-full p-1 cursor-pointer hover:bg-muted">
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
            </label>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Display Name"><Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-10" /></Field>
            <Field label="Email (read-only)"><Input value={email} disabled className="h-10 bg-muted/30" /></Field>
          </div>
        </div>
        <Button onClick={saveAccount} disabled={saving} className="bg-accent hover:bg-accent/90 text-white gap-1">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save Changes
        </Button>

        <div className="border-t border-card-border pt-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Change Password</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Current Password"><Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="h-10" /></Field>
            <Field label="New Password"><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="h-10" /></Field>
            <Field label="Confirm New Password"><Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="h-10" /></Field>
          </div>
          <Button onClick={changePassword} disabled={saving} variant="outline" className="gap-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}Update Password
          </Button>
        </div>
      </Section>

      {/* Platform Settings */}
      <Section title="Platform Settings">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Commission Rate (%)">
            <Input type="number" value={commission} onChange={e => setCommission(e.target.value)} className="h-10" min="0" max="50" />
          </Field>
          <Field label="Minimum Booking Amount (₹)">
            <Input type="number" value={minBooking} onChange={e => setMinBooking(e.target.value)} className="h-10" />
          </Field>
          <Field label="Maximum Booking Amount (₹)">
            <Input type="number" value={maxBooking} onChange={e => setMaxBooking(e.target.value)} className="h-10" />
          </Field>
          <Field label="Auto-Block after X Warnings">
            <Input type="number" value={autoBlockWarnings} onChange={e => setAutoBlockWarnings(e.target.value)} className="h-10" min="1" max="10" />
          </Field>
          <Field label="Review Window (hours)">
            <Input type="number" value={reviewWindow} onChange={e => setReviewWindow(e.target.value)} className="h-10" />
          </Field>
          <Field label="Support Email">
            <Input value={supportEmail} onChange={e => setSupportEmail(e.target.value)} className="h-10" />
          </Field>
          <Field label="Support Phone">
            <Input value={supportPhone} onChange={e => setSupportPhone(e.target.value)} className="h-10" />
          </Field>
        </div>
        <Field label="Cancellation Policy">
          <Textarea value={cancellationPolicy} onChange={e => setCancellationPolicy(e.target.value)} className="min-h-[80px] resize-none" />
        </Field>
        <Button onClick={() => requirePwConfirm(savePlatformSettings)} className="bg-accent hover:bg-accent/90 text-white gap-1">
          <Shield className="h-4 w-4" />Save Platform Settings
        </Button>
        <p className="text-[11px] text-muted-foreground">Changing commission rate requires password re-confirmation.</p>
      </Section>

      {/* Notification Settings */}
      <Section title="Admin Notification Settings">
        <div className="divide-y divide-card-border">
          <Toggle label="New Dispute Raised" checked={notifDispute} onChange={setNotifDispute} />
          <Toggle label="New Verification Request" checked={notifVerification} onChange={setNotifVerification} />
          <Toggle label="User Appeal Submitted" checked={notifAppeal} onChange={setNotifAppeal} />
          <Toggle label="High Value Booking (above threshold)" checked={notifHighValue} onChange={setNotifHighValue} />
          <Toggle label="Suspicious Activity Detected" checked={notifSuspicious} onChange={setNotifSuspicious} />
        </div>
        <Button onClick={saveNotifSettings} className="bg-accent hover:bg-accent/90 text-white">Save Notification Settings</Button>
      </Section>

      {/* Manage Admins */}
      <Section title="Manage Admins">
        <div className="flex justify-end">
          <Button onClick={() => setShowAddAdmin(true)} className="gap-2"><Plus className="h-4 w-4" />Add New Admin</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted/30">
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-semibold">Name</th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-semibold">Role</th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-semibold">Last Login</th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id} className="border-b border-card-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{a.display_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                      {(a.permissions as any)?.role || "super_admin"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.last_login_at ? format(new Date(a.last_login_at), "dd MMM yyyy HH:mm") : "Never"}</td>
                  <td className="px-4 py-3">
                    {a.user_id !== session?.user.id && (
                      <button onClick={() => removeAdmin(a.id, a.user_id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Password re-confirm modal */}
      <Dialog open={showPwConfirm} onOpenChange={o => !o && setShowPwConfirm(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Confirm Your Password</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This is a sensitive action. Please re-enter your password to continue.</p>
          <Input type="password" placeholder="Your password" value={pwConfirmValue} onChange={e => setPwConfirmValue(e.target.value)} className="h-10" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPwConfirm(false)}>Cancel</Button>
            <Button onClick={executePwConfirm} disabled={saving} className="gap-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add admin modal */}
      <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add New Admin</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Email Address">
              <Input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="admin@gigznation.com" className="h-10" />
            </Field>
            <Field label="Role">
              <Select value={newAdminRole} onValueChange={setNewAdminRole}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin — Full access</SelectItem>
                  <SelectItem value="moderator">Moderator — View & warn, no blocking</SelectItem>
                  <SelectItem value="analyst">Analyst — View analytics only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddAdmin(false)}>Cancel</Button>
            <Button onClick={addAdmin} disabled={addingAdmin} className="gap-1">
              {addingAdmin && <Loader2 className="h-4 w-4 animate-spin" />}Add Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettings;

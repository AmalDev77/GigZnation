import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Phone, Mail, BadgeCheck, Bell, MessageSquare, CreditCard, Star, Megaphone,
  Eye, DollarSign, MessageCircle, HelpCircle, AlertTriangle, FileText, Shield, LogOut, Trash2, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";

type Settings = {
  notify_booking_requests: boolean;
  notify_messages: boolean;
  notify_payments: boolean;
  notify_reviews: boolean;
  notify_platform: boolean;
  profile_public: boolean;
  show_pricing: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  notify_booking_requests: true,
  notify_messages: true,
  notify_payments: true,
  notify_reviews: true,
  notify_platform: true,
  profile_public: true,
  show_pricing: true,
};

const Settings = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [verified, setVerified] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      const user = session.user;
      setUserId(user.id);
      setUserEmail(user.email || "");
      setUserPhone(user.phone || "");

      // Check verified status from artist or venue profile
      const { data: artistData } = await supabase
        .from("artist_profiles").select("verified").eq("user_id", user.id).maybeSingle();
      const { data: venueData } = await supabase
        .from("venue_profiles").select("verified").eq("user_id", user.id).maybeSingle();
      setVerified(artistData?.verified || venueData?.verified || false);

      // Load settings
      const { data: existing } = await supabase
        .from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (existing) {
        setSettings({
          notify_booking_requests: existing.notify_booking_requests,
          notify_messages: existing.notify_messages,
          notify_payments: existing.notify_payments,
          notify_reviews: existing.notify_reviews,
          notify_platform: existing.notify_platform,
          profile_public: existing.profile_public,
          show_pricing: existing.show_pricing,
        });
      } else {
        await supabase.from("user_settings").insert({ user_id: user.id });
      }
      setLoading(false);
    };
    init();
  }, [navigate]);

  const updateSetting = useCallback(async (key: keyof Settings, value: boolean) => {
    if (!userId) return;
    setSettings(prev => ({ ...prev, [key]: value }));
    await supabase.from("user_settings").update({ [key]: value }).eq("user_id", userId);
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    toast.success("Signed out successfully");
    navigate("/login");
  };

  const handleDeleteAccount = () => {
    toast.error("Account deletion requires OTP re-verification. This feature is coming soon.");
    setDeleteOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const phoneLast4 = userPhone ? `••••${userPhone.slice(-4)}` : "Not set";

  return (
    <div className="min-h-screen bg-background animate-fade-in pb-8">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-card-border">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
      </header>

      <div className="px-4 pt-4 space-y-6">
        {/* Account */}
        <SettingsSection title="Account">
          <SettingsRow icon={Phone} label="Change Phone Number" value={phoneLast4} />
          <SettingsRow icon={Mail} label="Linked Google Account" value={userEmail || "Not linked"} />
          <SettingsRow
            icon={BadgeCheck}
            label="Verify Account"
            right={
              verified ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">Verified</span>
              ) : (
                <button className="px-3 py-1 rounded-btn text-[11px] font-semibold bg-accent text-white">
                  Request Verification
                </button>
              )
            }
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <ToggleRow icon={Bell} label="New Booking Requests" checked={settings.notify_booking_requests} onChange={v => updateSetting("notify_booking_requests", v)} />
          <ToggleRow icon={MessageSquare} label="Messages" checked={settings.notify_messages} onChange={v => updateSetting("notify_messages", v)} />
          <ToggleRow icon={CreditCard} label="Payment Updates" checked={settings.notify_payments} onChange={v => updateSetting("notify_payments", v)} />
          <ToggleRow icon={Star} label="Review Reminders" checked={settings.notify_reviews} onChange={v => updateSetting("notify_reviews", v)} />
          <ToggleRow icon={Megaphone} label="Platform Updates" checked={settings.notify_platform} onChange={v => updateSetting("notify_platform", v)} />
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection title="Privacy">
          <ToggleRow icon={Eye} label="Profile Visibility" subtitle={settings.profile_public ? "Public" : "Members Only"} checked={settings.profile_public} onChange={v => updateSetting("profile_public", v)} />
          <ToggleRow icon={DollarSign} label="Show Pricing on Profile" checked={settings.show_pricing} onChange={v => updateSetting("show_pricing", v)} />
        </SettingsSection>

        {/* Support */}
        <SettingsSection title="Support">
          <SettingsRow icon={MessageCircle} label="Chat with Support" onClick={() => window.location.href = "mailto:support@gigznation.com"} />
          <SettingsRow icon={HelpCircle} label="FAQ / Help Centre" onClick={() => window.open("https://gigznation.com/faq", "_blank")} />
          <SettingsRow icon={AlertTriangle} label="Report a Problem" onClick={() => window.location.href = "mailto:support@gigznation.com?subject=Bug Report"} />
        </SettingsSection>

        {/* Legal */}
        <SettingsSection title="Legal">
          <SettingsRow icon={FileText} label="Terms of Service" onClick={() => window.open("https://gigznation.com/terms", "_blank")} />
          <SettingsRow icon={Shield} label="Privacy Policy" onClick={() => window.open("https://gigznation.com/privacy", "_blank")} />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Danger Zone">
          <Button
            variant="destructive"
            className="w-full rounded-btn gap-2 font-display font-semibold"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-btn gap-2 font-display font-semibold text-destructive border-destructive/30 hover:bg-destructive/5 mt-2"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </SettingsSection>
      </div>

      {/* Logout Sheet */}
      <Sheet open={logoutOpen} onOpenChange={setLogoutOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-display text-lg">Sign out?</SheetTitle>
            <SheetDescription>You'll need to sign in again to access your account.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button variant="destructive" className="w-full rounded-btn font-display font-semibold" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Confirm Logout
            </Button>
            <Button variant="ghost" className="w-full rounded-btn" onClick={() => setLogoutOpen(false)}>Cancel</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Sheet */}
      <Sheet open={deleteOpen} onOpenChange={setDeleteOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-display text-lg text-destructive">Delete Account?</SheetTitle>
            <SheetDescription>This action is permanent. All your data including bookings, reviews, and messages will be deleted.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button variant="destructive" className="w-full rounded-btn font-display font-semibold" onClick={handleDeleteAccount}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete My Account
            </Button>
            <Button variant="ghost" className="w-full rounded-btn" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ── Helpers ── */

const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-[13px] font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{title}</h3>
    <div className="bg-card rounded-card border border-card-border divide-y divide-card-border">{children}</div>
  </div>
);

const SettingsRow = ({
  icon: Icon, label, value, right, onClick,
}: {
  icon: React.ElementType; label: string; value?: string; right?: React.ReactNode; onClick?: () => void;
}) => (
  <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
    {right || (value ? (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{value}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    ) : (
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    ))}
  </button>
);

const ToggleRow = ({
  icon: Icon, label, subtitle, checked, onChange,
}: {
  icon: React.ElementType; label: string; subtitle?: string; checked: boolean; onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between px-4 py-3">
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default Settings;

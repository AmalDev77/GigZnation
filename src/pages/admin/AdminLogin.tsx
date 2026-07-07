import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const logAttempt = async (userId: string | null, success: boolean, errorMsg?: string) => {
    try {
      if (!userId) return;
      await supabase.from("admin_actions_log").insert({
        admin_id: userId,
        action: "admin_login_attempt",
        details: { email, success, error: errorMsg || null, timestamp: new Date().toISOString() },
      });
    } catch {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !authData.session) {
      toast({ title: "Login failed", description: error?.message || "Invalid credentials", variant: "destructive" });
      setLoading(false);
      return;
    }

    const userId = authData.session.user.id;

    // Check super_admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      await logAttempt(userId, false, "Not a super_admin");
      await supabase.auth.signOut();
      toast({ title: "Access Denied", description: "You do not have admin access.", variant: "destructive" });
      setLoading(false);
      return;
    }

    await logAttempt(userId, true);
    navigate("/admin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#7C5CBF" }}>
      <div className="w-full max-w-[400px]">
        <div className="bg-white rounded-xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-14 w-14 rounded-xl flex items-center justify-center mb-4" style={{ background: "#7C5CBF" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h1 className="font-display font-bold text-[22px] tracking-tight" style={{ color: "#1A1033" }}>
              Super Admin Portal
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Lock className="h-3.5 w-3.5" style={{ color: "#EF4444" }} />
              <span className="text-[13px] font-body" style={{ color: "#EF4444" }}>Restricted Access Only</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
              <input
                type="email"
                placeholder="Admin email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full h-12 pl-11 pr-4 rounded-lg border text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/40"
                style={{ borderColor: "#E8E4F5" }}
              />
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full h-12 pl-4 pr-11 rounded-lg border text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/40"
                style={{ borderColor: "#E8E4F5" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg text-white font-display font-semibold text-[15px] flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ background: "#7C5CBF", height: "52px" }}
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              Sign In to Admin
            </button>
          </form>

          <p className="text-center text-[12px] mt-5 font-body" style={{ color: "#7C6FAA" }}>
            Forgot admin password? Contact tech support.
          </p>
        </div>

        <p className="text-center text-xs text-white/60 mt-6">© 2026 GigZnation. All rights reserved.</p>
      </div>
    </div>
  );
};

export default AdminLogin;

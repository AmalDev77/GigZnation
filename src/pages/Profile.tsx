import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

const Profile = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUser(session.user);

      // Check if user is an artist → redirect to artist profile
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (roles?.some(r => r.role === "artist")) {
        navigate("/artist-profile", { replace: true });
        return;
      }
      if (roles?.some(r => r.role === "venue")) {
        navigate("/venue-profile", { replace: true });
        return;
      }
    };
    init();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/login");
  };

  if (!user) return null;

  const meta = user.user_metadata;

  return (
    <div className="animate-fade-in">
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-display font-bold">Profile</h1>
      </header>

      <div className="px-5 space-y-6">
        {/* Avatar & Info */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-display font-bold text-primary">
            {(meta?.full_name || "U")[0].toUpperCase()}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">{meta?.full_name || "User"}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary capitalize">
              {meta?.role || "user"}
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-1">
          {[
            { label: "Edit Profile", icon: Settings },
            { label: "Settings", icon: Settings, route: "/settings" },
            { label: "Notifications", icon: Settings, route: "/notifications" },
            { label: "Notifications", icon: Settings },
          ].map(({ label, icon: Icon, route }) => (
            <button
              key={label}
              onClick={() => route && navigate(route)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <Button onClick={handleLogout} variant="outline" className="w-full rounded-btn gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Profile;

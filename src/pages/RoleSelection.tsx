import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Guitar, Building2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const roles: {
  value: AppRole;
  label: string;
  desc: string;
  icon: typeof Guitar;
  iconClass: string;
}[] = [
  {
    value: "artist",
    label: "Artist / Performer",
    desc: "Find gigs, get discovered, and get paid",
    icon: Guitar,
    iconClass: "text-primary",
  },
  {
    value: "venue",
    label: "Venue Owner",
    desc: "Discover and book verified local talent",
    icon: Building2,
    iconClass: "text-info",
  },
];

const RoleSelection = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<AppRole | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be signed in");
      setSaving(false);
      return;
    }

    // Upsert role in user_roles (trigger may have created a default row)
    const { error } = await supabase
      .from("user_roles")
      .upsert(
        { user_id: user.id, role: selected },
        { onConflict: "user_id,role" }
      );

    setSaving(false);

    if (error) {
      toast.error("Failed to save role. Please try again.");
      console.error(error);
    } else {
      toast.success(`Welcome as ${selected === "artist" ? "an Artist" : "a Venue Owner"}!`);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-6 pt-10 pb-8">
      {/* Logo */}
      <h2 className="font-display font-bold text-lg text-primary">GigZnation</h2>

      {/* Heading */}
      <h1 className="mt-8 font-display font-bold text-[28px] leading-tight text-foreground text-center">
        I am a…
      </h1>

      {/* Subtitle */}
      <p className="mt-2 flex items-center gap-1.5 font-body text-[13px] text-muted-foreground text-center">
        <AlertTriangle size={14} className="shrink-0" />
        Choose your role. This cannot be changed later.
      </p>

      {/* Role cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-sm">
        {roles.map((role) => {
          const isSelected = selected === role.value;
          const hasSelection = selected !== null;
          const Icon = role.icon;

          return (
            <button
              key={role.value}
              onClick={() => setSelected(role.value)}
              className={cn(
                "relative flex flex-col items-center rounded-xl border bg-card p-5 text-center transition-all",
                isSelected
                  ? "border-2 border-primary opacity-100 shadow-md"
                  : "border border-card-border",
                hasSelection && !isSelected && "opacity-60"
              )}
            >
              {/* Checkmark badge */}
              {isSelected && (
                <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Check size={14} className="text-primary-foreground" />
                </div>
              )}

              <Icon size={32} className={cn("mb-3", role.iconClass)} />
              <span className="font-display font-semibold text-lg leading-snug text-foreground">
                {role.label}
              </span>
              <span className="mt-1.5 font-body text-[13px] text-muted-foreground leading-snug">
                {role.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!selected || saving}
        className={cn(
          "mt-10 h-12 w-full max-w-sm rounded-btn font-body text-sm font-semibold transition",
          selected
            ? "bg-accent text-accent-foreground hover:opacity-90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {saving ? "Saving…" : "Continue"}
      </button>
    </div>
  );
};

export default RoleSelection;

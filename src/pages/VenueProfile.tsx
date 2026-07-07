import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft } from "lucide-react";
import VenueCoverBanner from "@/components/venue-profile/VenueCoverBanner";
import VenueLogoSection from "@/components/venue-profile/VenueLogoSection";
import VenueAboutSection from "@/components/venue-profile/VenueAboutSection";
import VenueDetailsSection from "@/components/venue-profile/VenueDetailsSection";
import VenueAmenities from "@/components/venue-profile/VenueAmenities";
import VenuePastPerformances from "@/components/venue-profile/VenuePastPerformances";
import VenueUpcomingGigs from "@/components/venue-profile/VenueUpcomingGigs";
import VenueReviews from "@/components/venue-profile/VenueReviews";

export interface VenueProfileData {
  id: string;
  user_id: string;
  venue_name: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  capacity: number | null;
  venue_type: string | null;
  description: string | null;
  rating: number | null;
  verified: boolean | null;
  cover_photo_url: string | null;
  logo_url: string | null;
  operating_hours_start: string | null;
  operating_hours_end: string | null;
  amenities: Record<string, boolean>;
}

const VenueProfile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<VenueProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUser(session.user);

      const { data, error } = await supabase
        .from("venue_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) { console.error(error); toast.error("Failed to load profile"); }

      if (data) {
        setProfile({
          ...data,
          amenities: (data.amenities && typeof data.amenities === "object" && !Array.isArray(data.amenities))
            ? (data.amenities as Record<string, boolean>)
            : {},
        });
      } else {
        const { data: newProfile, error: insertErr } = await supabase
          .from("venue_profiles")
          .insert({ user_id: session.user.id, venue_name: session.user.user_metadata?.full_name || "" })
          .select()
          .single();
        if (insertErr) console.error(insertErr);
        if (newProfile) {
          setProfile({ ...newProfile, amenities: {} });
        }
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  const updateField = useCallback(async (fields: Partial<Record<string, any>>) => {
    if (!profile) return;
    const { error } = await supabase
      .from("venue_profiles")
      .update(fields)
      .eq("id", profile.id);
    if (error) {
      toast.error("Failed to save");
      console.error(error);
    } else {
      setProfile(prev => prev ? { ...prev, ...fields } as VenueProfileData : prev);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || !user) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-3 left-4 z-30 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
      >
        <ArrowLeft size={18} className="text-foreground" />
      </button>

      <VenueCoverBanner
        coverUrl={profile.cover_photo_url}
        userId={user.id}
        onUpdate={(url) => updateField({ cover_photo_url: url })}
      />

      <VenueLogoSection
        logoUrl={profile.logo_url}
        venueName={profile.venue_name}
        userId={user.id}
        onUpdate={(url) => updateField({ logo_url: url })}
      />

      {/* Name & tags */}
      <div className="px-5 mt-2 text-center">
        <h1 className="font-display font-bold text-2xl text-foreground">
          {profile.venue_name || "Your Venue Name"}
        </h1>

        {profile.venue_type && (
          <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-info/10 text-info">
            {profile.venue_type}
          </span>
        )}

        <div className="mt-1.5 flex items-center justify-center gap-1 text-muted-foreground">
          {(profile.city || profile.area) && (
            <span className="font-body text-sm">
              {[profile.area, profile.city].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* Editable sections */}
      <div className="px-5 mt-6 space-y-6">
        <VenueAboutSection
          description={profile.description}
          venueName={profile.venue_name}
          city={profile.city}
          area={profile.area}
          onSave={(fields) => updateField(fields)}
        />

        <VenueDetailsSection
          venueType={profile.venue_type}
          capacity={profile.capacity}
          hoursStart={profile.operating_hours_start}
          hoursEnd={profile.operating_hours_end}
          onSave={(fields) => updateField(fields)}
        />

        <VenueAmenities
          amenities={profile.amenities}
          onUpdate={(amenities) => updateField({ amenities })}
        />

        <VenuePastPerformances venueProfileId={profile.id} />
        <VenueUpcomingGigs venueProfileId={profile.id} />
        <VenueReviews venueProfileId={profile.id} />
      </div>
    </div>
  );
};

export default VenueProfile;

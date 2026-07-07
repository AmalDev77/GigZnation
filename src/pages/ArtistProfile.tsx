import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import CoverBanner from "@/components/artist-profile/CoverBanner";
import AvatarSection from "@/components/artist-profile/AvatarSection";
import ProfileStrength from "@/components/artist-profile/ProfileStrength";
import BioSection from "@/components/artist-profile/BioSection";
import MediaGallery from "@/components/artist-profile/MediaGallery";
import AvailabilityCalendar from "@/components/artist-profile/AvailabilityCalendar";
import PricingSection from "@/components/artist-profile/PricingSection";
import ReviewsSection from "@/components/artist-profile/ReviewsSection";

export interface ArtistProfileData {
  id: string;
  user_id: string;
  stage_name: string | null;
  genre: string | null;
  city: string | null;
  bio: string | null;
  cover_photo_url: string | null;
  avatar_url: string | null;
  media_urls: string[];
  availability: Record<string, "available" | "unavailable">;
  min_price: number | null;
  max_price: number | null;
  price_per_hour: number | null;
  rating: number | null;
  total_gigs: number | null;
  verified: boolean | null;
}

const ArtistProfile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ArtistProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUser(session.user);

      const { data, error } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        toast.error("Failed to load profile");
      }

      if (data) {
        setProfile({
          ...data,
          avatar_url: (data as any).avatar_url ?? session.user.user_metadata?.avatar_url ?? null,
          media_urls: Array.isArray(data.media_urls) ? (data.media_urls as string[]) : [],
          availability: (data.availability && typeof data.availability === "object" && !Array.isArray(data.availability))
            ? (data.availability as Record<string, "available" | "unavailable">)
            : {},
        });
      } else {
        // Create a blank profile
        const { data: newProfile, error: insertErr } = await supabase
          .from("artist_profiles")
          .insert({ user_id: session.user.id, stage_name: session.user.user_metadata?.full_name || "" })
          .select()
          .single();
        if (insertErr) console.error(insertErr);
        if (newProfile) {
          setProfile({
            ...newProfile,
            avatar_url: session.user.user_metadata?.avatar_url ?? null,
            media_urls: [],
            availability: {},
          });
        }
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  const updateField = useCallback(async (fields: Partial<Record<string, any>>) => {
    if (!profile) return;
    const { error } = await supabase
      .from("artist_profiles")
      .update(fields)
      .eq("id", profile.id);
    if (error) {
      toast.error("Failed to save");
      console.error(error);
    } else {
      setProfile(prev => prev ? { ...prev, ...fields } as ArtistProfileData : prev);
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

  // Profile strength calculation
  const fields = [
    !!profile.stage_name,
    !!profile.bio,
    !!profile.city,
    !!profile.genre,
    !!profile.cover_photo_url,
    profile.media_urls.length > 0,
    profile.min_price !== null && profile.max_price !== null,
    Object.keys(profile.availability).length > 0,
  ];
  const filledCount = fields.filter(Boolean).length;
  const strengthPercent = Math.round((filledCount / fields.length) * 100);

  const nextNudge = !profile.bio
    ? "Add your bio"
    : !profile.city
    ? "Add your city"
    : !profile.genre
    ? "Add your genre"
    : !profile.cover_photo_url
    ? "Add a cover photo"
    : profile.media_urls.length === 0
    ? "Upload some media"
    : profile.min_price === null
    ? "Set your pricing"
    : Object.keys(profile.availability).length === 0
    ? "Mark your availability"
    : null;

  const nextPercent = strengthPercent < 100 ? Math.min(strengthPercent + Math.round(100 / fields.length), 100) : 100;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <button
          onClick={() => setPreviewMode(!previewMode)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition",
            previewMode
              ? "bg-primary text-primary-foreground"
              : "bg-background/80 backdrop-blur text-foreground"
          )}
        >
          <Eye size={14} />
          {previewMode ? "Exit Preview" : "Preview as Venue"}
        </button>
      </div>

      {/* Cover Banner */}
      <CoverBanner
        coverUrl={profile.cover_photo_url}
        userId={user.id}
        onUpdate={(url) => updateField({ cover_photo_url: url })}
        readOnly={previewMode}
      />

      {/* Avatar */}
      <AvatarSection
        avatarUrl={profile.avatar_url}
        stageName={profile.stage_name}
        userId={user.id}
        onUpdate={(url) => updateField({ avatar_url: url })}
        readOnly={previewMode}
      />

      {/* Name, Tags */}
      <div className="px-5 mt-2 text-center">
        <h1 className="font-display font-bold text-2xl text-foreground">
          {profile.stage_name || "Your Stage Name"}
        </h1>
        <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
          {profile.city && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#EDE9FF] text-primary">
              {profile.city}
            </span>
          )}
          {profile.genre && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#EDE9FF] text-primary">
              {profile.genre}
            </span>
          )}
          {!profile.city && !profile.genre && (
            <span className="text-xs text-muted-foreground">Add city & genre below</span>
          )}
        </div>
      </div>

      {/* Profile Strength */}
      {!previewMode && (
        <div className="px-5 mt-5">
          <ProfileStrength
            percent={strengthPercent}
            nudge={nextNudge}
            nextPercent={nextPercent}
          />
        </div>
      )}

      {/* Sections */}
      <div className="px-5 mt-6 space-y-6">
        <BioSection
          bio={profile.bio}
          stageName={profile.stage_name}
          city={profile.city}
          genre={profile.genre}
          onSave={(fields) => updateField(fields)}
          readOnly={previewMode}
        />

        <MediaGallery
          mediaUrls={profile.media_urls}
          userId={user.id}
          onUpdate={(urls) => updateField({ media_urls: urls })}
          readOnly={previewMode}
        />

        <AvailabilityCalendar
          availability={profile.availability}
          onUpdate={(avail) => updateField({ availability: avail })}
          readOnly={previewMode}
        />

        <PricingSection
          minPrice={profile.min_price}
          maxPrice={profile.max_price}
          onSave={(min, max) => updateField({ min_price: min, max_price: max })}
          readOnly={previewMode}
        />

        <ReviewsSection artistProfileId={profile.id} />
      </div>
    </div>
  );
};

export default ArtistProfile;

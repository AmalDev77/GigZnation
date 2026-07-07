import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Star, ChevronDown, X, Loader2, Flag, Eye, ShieldCheck, Building2, Users,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Venue = {
  id: string;
  user_id: string;
  venue_name: string | null;
  venue_type: string | null;
  city: string | null;
  capacity: number | null;
  rating: number | null;
  created_at: string;
  logo_url: string | null;
  adminReview: any | null;
};

const CATEGORIES = ["Payment Reliability", "Artist Hospitality", "Technical Quality", "Venue Atmosphere", "Management Professionalism"];

const AdminVenueReviews = () => {
  const { toast } = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filtered, setFiltered] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [types, setTypes] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const [modalVenue, setModalVenue] = useState<Venue | null>(null);
  const [overallRating, setOverallRating] = useState(0);
  const [catRatings, setCatRatings] = useState<Record<string, number>>({});
  const [reviewText, setReviewText] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "public">("internal");
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState({ reviewed: 0, avgRating: 0, flagged: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: venueData }, { data: adminReviews }] = await Promise.all([
      supabase.from("venue_profiles").select("id, user_id, venue_name, venue_type, city, capacity, rating, created_at, logo_url"),
      supabase.from("venue_ratings_by_admin").select("*"),
    ]);

    const reviewMap = new Map<string, any>();
    (adminReviews || []).forEach((r: any) => reviewMap.set(r.venue_id, r));

    const typeSet = new Set<string>();
    const citySet = new Set<string>();

    const mapped: Venue[] = (venueData || []).map(v => {
      if (v.venue_type) typeSet.add(v.venue_type);
      if (v.city) citySet.add(v.city);
      return { ...v, adminReview: reviewMap.get(v.id) || null };
    });

    setTypes(Array.from(typeSet).sort());
    setCities(Array.from(citySet).sort());
    setVenues(mapped);

    const reviewed = mapped.filter(v => v.adminReview);
    const ratings = reviewed.map(v => v.adminReview.rating).filter(Boolean);
    setStats({
      reviewed: reviewed.length,
      avgRating: ratings.length ? Math.round((ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length) * 10) / 10 : 0,
      flagged: reviewed.filter(v => v.adminReview?.flagged).length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let result = [...venues];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(v => (v.venue_name || "").toLowerCase().includes(q) || (v.city || "").toLowerCase().includes(q));
    }
    if (typeFilter !== "all") result = result.filter(v => v.venue_type === typeFilter);
    if (cityFilter !== "all") result = result.filter(v => v.city === cityFilter);
    if (ratingFilter !== "all") {
      const [min, max] = ratingFilter.split("-").map(Number);
      result = result.filter(v => (v.rating || 0) >= min && (v.rating || 0) <= max);
    }
    if (statusFilter === "reviewed") result = result.filter(v => v.adminReview);
    if (statusFilter === "not_reviewed") result = result.filter(v => !v.adminReview);
    setFiltered(result);
  }, [venues, search, typeFilter, cityFilter, ratingFilter, statusFilter]);

  const openModal = (venue: Venue) => {
    setModalVenue(venue);
    const existing = venue.adminReview;
    if (existing) {
      setOverallRating(existing.rating || 0);
      setCatRatings(existing.category_ratings || {});
      setReviewText(existing.notes || "");
      setVisibility(existing.visibility || "internal");
    } else {
      setOverallRating(0);
      setCatRatings({});
      setReviewText("");
      setVisibility("internal");
    }
  };

  const handleSave = async (flagged?: boolean) => {
    if (!modalVenue || overallRating === 0) {
      toast({ title: "Rating required", description: "Please select an overall rating.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const payload = {
      venue_id: modalVenue.id,
      admin_id: session.user.id,
      rating: overallRating,
      notes: reviewText,
      category_ratings: catRatings,
      visibility,
      flagged: flagged ?? modalVenue.adminReview?.flagged ?? false,
      updated_at: new Date().toISOString(),
    };

    if (modalVenue.adminReview) {
      await supabase.from("venue_ratings_by_admin").update(payload).eq("id", modalVenue.adminReview.id);
    } else {
      await supabase.from("venue_ratings_by_admin").insert(payload);
    }

    await supabase.from("admin_actions_log").insert({
      admin_id: session.user.id,
      action: flagged ? "flag_venue" : "rate_venue",
      target_id: modalVenue.id,
      target_type: "venue",
      details: { rating: overallRating, flagged: flagged ?? false },
    });

    toast({ title: flagged ? "Venue flagged" : "Review saved", description: flagged ? `${modalVenue.venue_name || "Venue"} flagged.` : "Admin review saved successfully." });
    setSaving(false);
    setModalVenue(null);
    fetchData();
  };

  const StarSelector = ({ value, onChange, size = 20 }: { value: number; onChange: (v: number) => void; size?: number }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange(s)} className="transition-transform hover:scale-110">
          <Star className={s <= value ? "fill-[#F4845F]" : ""} style={{ color: s <= value ? "#F4845F" : "#E8E4F5", width: size, height: size }} />
        </button>
      ))}
    </div>
  );

  const FilterSelect = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className="appearance-none text-[13px] font-medium px-3 py-2 pr-8 rounded-lg border bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5", color: "#1A1033" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "#7C6FAA" }} />
    </div>
  );

  const StatCard = ({ label, value, color, icon: Icon }: { label: string; value: string | number; color: string; icon: any }) => (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E8E4F5" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: color + "15" }}>
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-display font-bold" style={{ color: "#1A1033" }}>{value}</p>
      <p className="text-[12px] mt-1" style={{ color: "#7C6FAA" }}>{label}</p>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 min-h-screen" style={{ background: "#F5F3FF" }}>
      <h1 className="text-[28px] font-display font-bold mb-6" style={{ color: "#1A1033" }}>Venue Reviews — Admin Panel</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Venues Reviewed by Admin" value={stats.reviewed} color="#0EA5A0" icon={ShieldCheck} />
        <StatCard label="Average Venue Rating Given" value={stats.avgRating} color="#F4845F" icon={Star} />
        <StatCard label="Venues Flagged" value={stats.flagged} color="#EF4444" icon={Flag} />
      </div>

      {/* Search + Filters */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5" style={{ color: "#7C5CBF" }} />
        <input type="text" placeholder="Search by venue name or city..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-12 pl-12 pr-4 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5" }} />
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <FilterSelect value={typeFilter} onChange={setTypeFilter} options={[{ value: "all", label: "All Types" }, ...types.map(t => ({ value: t, label: t }))]} />
        <FilterSelect value={cityFilter} onChange={setCityFilter} options={[{ value: "all", label: "All Cities" }, ...cities.map(c => ({ value: c, label: c }))]} />
        <FilterSelect value={ratingFilter} onChange={setRatingFilter} options={[
          { value: "all", label: "All Ratings" }, { value: "4-5", label: "4-5 ★" }, { value: "3-4", label: "3-4 ★" }, { value: "2-3", label: "2-3 ★" }, { value: "0-2", label: "Below 2 ★" },
        ]} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[
          { value: "all", label: "All Status" }, { value: "reviewed", label: "Reviewed by Admin" }, { value: "not_reviewed", label: "Not Yet Reviewed" },
        ]} />
      </div>

      {/* Venue Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#7C5CBF" }} /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-16 text-sm" style={{ color: "#7C6FAA" }}>No venues found.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(v => {
            const isFlagged = v.adminReview?.flagged;
            return (
              <div key={v.id} className="bg-white rounded-xl border p-5 transition-all" style={{ borderColor: isFlagged ? "#F4845F" : "#E8E4F5", borderWidth: isFlagged ? 2 : 1, background: isFlagged ? "#FFF7ED" : "white" }}>
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-xl bg-[#F0FDFA] flex items-center justify-center overflow-hidden shrink-0">
                    {v.logo_url ? (
                      <img src={v.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-7 w-7" style={{ color: "#0EA5A0" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-[16px] truncate" style={{ color: "#1A1033" }}>{v.venue_name || "Unnamed Venue"}</h3>
                      {isFlagged && <Flag className="h-4 w-4 shrink-0" style={{ color: "#F4845F" }} />}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {v.venue_type && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#F0FDFA", color: "#0EA5A0" }}>{v.venue_type}</span>
                      )}
                      {v.capacity && (
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: "#7C6FAA" }}>
                          <Users className="h-3 w-3" />{v.capacity} cap.
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[12px]" style={{ color: "#7C6FAA" }}>
                      {v.city && <span>{v.city}</span>}
                      <span>Member since {format(new Date(v.created_at), "MMM yyyy")}</span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-medium w-24" style={{ color: "#7C6FAA" }}>Public Rating</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-[#F4845F]" style={{ color: "#F4845F" }} />
                          <span className="text-[13px] font-semibold" style={{ color: "#F4845F" }}>{v.rating || "0"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-medium w-24" style={{ color: "#7C6FAA" }}>Admin Rating</span>
                        {v.adminReview ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-[#0EA5A0]" style={{ color: "#0EA5A0" }} />
                              <span className="text-[13px] font-semibold" style={{ color: "#0EA5A0" }}>{v.adminReview.rating}</span>
                            </div>
                            <button onClick={() => openModal(v)} className="text-[12px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: "#F0FDFA", color: "#0EA5A0" }}>Edit Review</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px]" style={{ color: "#7C6FAA" }}>Not reviewed</span>
                            <button onClick={() => openModal(v)} className="text-[12px] font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: "#F4845F" }}>Rate This Venue</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {modalVenue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b rounded-t-xl" style={{ borderColor: "#E8E4F5" }}>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-[#F0FDFA] flex items-center justify-center overflow-hidden">
                  {modalVenue.logo_url ? (
                    <img src={modalVenue.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-6 w-6" style={{ color: "#0EA5A0" }} />
                  )}
                </div>
                <div>
                  <p className="font-display font-bold" style={{ color: "#1A1033" }}>{modalVenue.venue_name || "Venue"}</p>
                  <p className="text-[12px]" style={{ color: "#7C6FAA" }}>Admin Review</p>
                </div>
              </div>
              <button onClick={() => setModalVenue(null)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[#F5F3FF]">
                <X className="h-4 w-4" style={{ color: "#7C6FAA" }} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-[13px] font-semibold mb-2 block" style={{ color: "#1A1033" }}>Overall Rating</label>
                <StarSelector value={overallRating} onChange={setOverallRating} size={28} />
              </div>

              <div className="space-y-3">
                {CATEGORIES.map(cat => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#1A1033" }}>{cat}</span>
                    <StarSelector value={catRatings[cat] || 0} onChange={v => setCatRatings({ ...catRatings, [cat]: v })} size={18} />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[13px] font-semibold mb-2 block" style={{ color: "#1A1033" }}>Admin Assessment</label>
                <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Write your admin assessment of this venue..."
                  className="w-full rounded-lg border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ borderColor: "#E8E4F5", height: 150 }} />
              </div>

              <div>
                <label className="text-[13px] font-semibold mb-2 block" style={{ color: "#1A1033" }}>Visibility</label>
                <div className="flex gap-2">
                  {(["internal", "public"] as const).map(v => (
                    <button key={v} onClick={() => setVisibility(v)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] font-medium transition-all"
                      style={{
                        borderColor: visibility === v ? "#0EA5A0" : "#E8E4F5",
                        background: visibility === v ? "#F0FDFA" : "white",
                        color: visibility === v ? "#0EA5A0" : "#7C6FAA",
                      }}>
                      {v === "internal" ? <Eye className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {v === "internal" ? "Internal Only" : "Public"}
                    </button>
                  ))}
                </div>
                {visibility === "public" && (
                  <p className="text-[11px] mt-1.5" style={{ color: "#059669" }}>Shown on venue profile with "Venue Verified by GigZnation" badge</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => handleSave(true)} disabled={saving}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold border-2 transition-colors"
                  style={{ borderColor: "#EF4444", color: "#EF4444", background: "white" }}>
                  <Flag className="h-4 w-4" />
                  Flag Venue
                </button>
                <button onClick={() => handleSave(false)} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-semibold"
                  style={{ background: "#F4845F" }}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVenueReviews;

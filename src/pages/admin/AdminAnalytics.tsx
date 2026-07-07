import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Area, AreaChart, Cell,
} from "recharts";
import { Loader2, Download, TrendingUp, TrendingDown } from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfMonth, endOfMonth, eachMonthOfInterval, getDay } from "date-fns";
import { cn } from "@/lib/utils";

const PURPLE = "#7C5CBF";
const ORANGE = "#F4845F";
const TEAL = "#0EA5A0";
const GREEN = "#059669";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RANGE_OPTIONS = [
  { label: "Last 7 Days", value: "7" },
  { label: "Last 30 Days", value: "30" },
  { label: "Last 90 Days", value: "90" },
];

const AdminAnalytics = () => {
  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [r1, r2, r3, r4, r5] = await Promise.all([
        supabase.from("user_roles").select("role, created_at, user_id"),
        supabase.from("bookings").select("id, artist_id, venue_id, date, amount, status, created_at, start_time, end_time, notes").limit(1000),
        supabase.from("artist_profiles").select("id, stage_name, genre, city, rating, cover_photo_url, user_id"),
        supabase.from("venue_profiles").select("id, venue_name, city, rating, logo_url, user_id"),
        supabase.from("reviews").select("id, booking_id, rating"),
      ]);
      setRoles(r1.data || []);
      setBookings(r2.data || []);
      setArtists(r3.data || []);
      setVenues(r4.data || []);
      setReviews(r5.data || []);
      setLoading(false);
    })();
  }, []);

  const days = parseInt(range);
  const startDate = subDays(new Date(), days);
  const dateInterval = eachDayOfInterval({ start: startDate, end: new Date() });

  // Section 1: Growth
  const signupData = useMemo(() => {
    return dateInterval.map(d => {
      const key = format(d, "yyyy-MM-dd");
      const artistCount = roles.filter(r => r.role === "artist" && r.created_at?.startsWith(key)).length;
      const venueCount = roles.filter(r => r.role === "venue" && r.created_at?.startsWith(key)).length;
      return { date: format(d, "dd MMM"), artists: artistCount, venues: venueCount };
    });
  }, [roles, dateInterval]);

  const weekMetrics = useMemo(() => {
    const now = new Date();
    const thisWeekStart = subDays(now, 7);
    const lastWeekStart = subDays(now, 14);
    const thisWeek = (arr: any[], dateField = "created_at") => arr.filter(a => new Date(a[dateField]) >= thisWeekStart).length;
    const lastWeek = (arr: any[], dateField = "created_at") => arr.filter(a => { const d = new Date(a[dateField]); return d >= lastWeekStart && d < thisWeekStart; }).length;
    const pct = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    const totalUsersThis = thisWeek(roles);
    const totalUsersLast = lastWeek(roles);
    const bookingsThis = thisWeek(bookings);
    const bookingsLast = lastWeek(bookings);
    const gmvThis = bookings.filter(b => new Date(b.created_at) >= thisWeekStart).reduce((s, b) => s + (b.amount || 0), 0);
    const gmvLast = bookings.filter(b => { const d = new Date(b.created_at); return d >= lastWeekStart && d < thisWeekStart; }).reduce((s, b) => s + (b.amount || 0), 0);

    return [
      { label: "Total Users", value: roles.length, change: pct(totalUsersThis, totalUsersLast) },
      { label: "Active Users", value: roles.filter(r => r.role !== "admin" && r.role !== "super_admin").length, change: pct(totalUsersThis, totalUsersLast) },
      { label: "Bookings", value: bookings.length, change: pct(bookingsThis, bookingsLast) },
      { label: "GMV", value: `₹${bookings.reduce((s, b) => s + (b.amount || 0), 0).toLocaleString("en-IN")}`, change: pct(gmvThis, gmvLast) },
    ];
  }, [roles, bookings]);

  // Section 2: Booking Analytics
  const bookingsByDay = useMemo(() => {
    const counts = Array(7).fill(0);
    bookings.forEach(b => { const d = getDay(new Date(b.date)); counts[d]++; });
    return DAYS.map((name, i) => ({ name, count: counts[i] }));
  }, [bookings]);

  const bookingsByGenre = useMemo(() => {
    const genreMap: Record<string, number> = {};
    const artistMap = Object.fromEntries(artists.map(a => [a.id, a]));
    bookings.forEach(b => {
      const genre = artistMap[b.artist_id]?.genre || "Unknown";
      genreMap[genre] = (genreMap[genre] || 0) + 1;
    });
    return Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [bookings, artists]);

  const avgBookingTrend = useMemo(() => {
    return dateInterval.filter((_, i) => i % Math.max(1, Math.floor(days / 15)) === 0).map(d => {
      const key = format(d, "yyyy-MM-dd");
      const dayBookings = bookings.filter(b => b.date <= key);
      const avg = dayBookings.length ? Math.round(dayBookings.reduce((s, b) => s + (b.amount || 0), 0) / dayBookings.length) : 0;
      return { date: format(d, "dd MMM"), avg };
    });
  }, [bookings, dateInterval]);

  // Section 3: Revenue
  const revenueData = useMemo(() => {
    const venueMap = Object.fromEntries(venues.map(v => [v.id, v]));
    const topCities = ["Bangalore", "Mumbai", "Delhi", "Pune"];
    const months = eachMonthOfInterval({ start: subDays(new Date(), 365), end: new Date() });
    return months.map(m => {
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      const mBookings = bookings.filter(b => { const d = new Date(b.date); return d >= mStart && d <= mEnd; });
      const entry: any = { month: format(m, "MMM yy") };
      topCities.forEach(c => { entry[c] = mBookings.filter(b => venueMap[b.venue_id]?.city === c).reduce((s, b) => s + (b.amount || 0), 0); });
      entry["Other"] = mBookings.filter(b => !topCities.includes(venueMap[b.venue_id]?.city || "")).reduce((s, b) => s + (b.amount || 0), 0);
      entry["commission"] = Math.round(mBookings.reduce((s, b) => s + (b.amount || 0), 0) * 0.1);
      return entry;
    });
  }, [bookings, venues]);

  // Section 4: User Quality
  const artistRatingDist = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    artists.forEach(a => { const r = Math.round(a.rating || 0); if (r >= 1 && r <= 5) dist[r - 1]++; });
    return dist.map((count, i) => ({ rating: `${i + 1}★`, count }));
  }, [artists]);

  const venueRatingDist = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    venues.forEach(v => { const r = Math.round(v.rating || 0); if (r >= 1 && r <= 5) dist[r - 1]++; });
    return dist.map((count, i) => ({ rating: `${i + 1}★`, count }));
  }, [venues]);

  const reviewPct = useMemo(() => {
    if (!bookings.length) return 0;
    const reviewedBookings = new Set(reviews.map(r => r.booking_id));
    return Math.round((reviewedBookings.size / bookings.length) * 100);
  }, [bookings, reviews]);

  // Section 5: Top Performers
  const topArtists = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const mBookings = bookings.filter(b => new Date(b.date) >= monthStart);
    const artistMap = Object.fromEntries(artists.map(a => [a.id, a]));
    const counts: Record<string, { count: number; earnings: number }> = {};
    mBookings.forEach(b => {
      if (!counts[b.artist_id]) counts[b.artist_id] = { count: 0, earnings: 0 };
      counts[b.artist_id].count++;
      counts[b.artist_id].earnings += b.amount || 0;
    });
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([id, data], i) => ({
      rank: i + 1, ...artistMap[id], ...data,
    }));
  }, [bookings, artists]);

  const topVenues = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const mBookings = bookings.filter(b => new Date(b.date) >= monthStart);
    const venueMap = Object.fromEntries(venues.map(v => [v.id, v]));
    const counts: Record<string, { count: number; spent: number }> = {};
    mBookings.forEach(b => {
      if (!counts[b.venue_id]) counts[b.venue_id] = { count: 0, spent: 0 };
      counts[b.venue_id].count++;
      counts[b.venue_id].spent += b.amount || 0;
    });
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([id, data], i) => ({
      rank: i + 1, ...venueMap[id], ...data,
    }));
  }, [bookings, venues]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-card rounded-xl border border-card-border p-5">
      <h3 className="text-sm font-display font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl md:text-[28px] font-display font-bold text-foreground">Platform Analytics</h1>
        <div className="flex gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}><Download className="h-4 w-4" />Export PDF</Button>
        </div>
      </div>

      {/* Section 1: Growth */}
      <section className="space-y-4">
        <h2 className="text-lg font-display font-bold text-foreground">Growth Metrics</h2>
        <ChartCard title="Daily Signups — Artists vs Venues">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={signupData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F5" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="artists" stroke={PURPLE} fill={PURPLE} fillOpacity={0.15} name="Artists" />
              <Area type="monotone" dataKey="venues" stroke={TEAL} fill={TEAL} fillOpacity={0.15} name="Venues" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {weekMetrics.map(m => (
            <div key={m.label} className="bg-card rounded-xl border border-card-border p-4">
              <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
              <p className="text-xl font-display font-bold text-foreground mt-1">{m.value}</p>
              <div className={cn("flex items-center gap-1 text-xs mt-1", m.change >= 0 ? "text-green-600" : "text-destructive")}>
                {m.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {m.change >= 0 ? "+" : ""}{m.change}% WoW
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Booking Analytics */}
      <section className="space-y-4">
        <h2 className="text-lg font-display font-bold text-foreground">Booking Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Bookings by Day of Week">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bookingsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F5" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={PURPLE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Bookings by Genre">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bookingsByGenre} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F5" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" fill={ORANGE} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <ChartCard title="Average Booking Value Trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={avgBookingTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F5" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Avg Value"]} />
              <Line type="monotone" dataKey="avg" stroke={PURPLE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Section 3: Revenue */}
      <section className="space-y-4">
        <h2 className="text-lg font-display font-bold text-foreground">Revenue Analytics</h2>
        <ChartCard title="Monthly GMV by City + Commission">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F5" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
              <Legend />
              <Bar dataKey="Bangalore" stackId="a" fill={PURPLE} />
              <Bar dataKey="Mumbai" stackId="a" fill={ORANGE} />
              <Bar dataKey="Delhi" stackId="a" fill={TEAL} />
              <Bar dataKey="Pune" stackId="a" fill={GREEN} />
              <Bar dataKey="Other" stackId="a" fill="#A0AEC0" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="commission" stroke="#1A1033" strokeWidth={2} dot={false} name="Commission" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Section 4: User Quality */}
      <section className="space-y-4">
        <h2 className="text-lg font-display font-bold text-foreground">User Quality Metrics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Artist Rating Distribution">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={artistRatingDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F5" />
                <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={PURPLE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Venue Rating Distribution">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={venueRatingDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4F5" />
                <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="bg-card rounded-xl border border-card-border p-5 flex flex-col items-center justify-center">
            <p className="text-xs text-muted-foreground font-medium">Bookings with Reviews</p>
            <p className="text-4xl font-display font-bold mt-2" style={{ color: PURPLE }}>{reviewPct}%</p>
            <p className="text-xs text-muted-foreground mt-1">{reviews.length} reviews from {bookings.length} bookings</p>
          </div>
        </div>
      </section>

      {/* Section 5: Top Performers */}
      <section className="space-y-4">
        <h2 className="text-lg font-display font-bold text-foreground">Top Performers This Month</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-card-border overflow-hidden">
            <div className="px-5 py-3 border-b border-card-border"><h3 className="text-sm font-display font-semibold">Top 10 Most Booked Artists</h3></div>
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/30 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Artist</th><th className="px-3 py-2 text-left">Genre</th><th className="px-3 py-2 text-left">City</th><th className="px-3 py-2 text-right">Bookings</th><th className="px-3 py-2 text-right">Earnings</th>
              </tr></thead>
              <tbody>
                {topArtists.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No bookings this month</td></tr> : topArtists.map(a => (
                  <tr key={a.rank} className="border-b border-card-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-bold text-muted-foreground">{a.rank}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {a.cover_photo_url ? <img src={a.cover_photo_url} className="h-7 w-7 rounded-full object-cover" /> : <div className="h-7 w-7 rounded-full bg-primary/20" />}
                        <span className="font-medium">{a.stage_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{a.genre || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.city || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{a.count}</td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ color: ORANGE }}>₹{a.earnings.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-card rounded-xl border border-card-border overflow-hidden">
            <div className="px-5 py-3 border-b border-card-border"><h3 className="text-sm font-display font-semibold">Top 10 Most Active Venues</h3></div>
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/30 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Venue</th><th className="px-3 py-2 text-left">City</th><th className="px-3 py-2 text-right">Bookings</th><th className="px-3 py-2 text-right">Total Spent</th>
              </tr></thead>
              <tbody>
                {topVenues.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No bookings this month</td></tr> : topVenues.map(v => (
                  <tr key={v.rank} className="border-b border-card-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-bold text-muted-foreground">{v.rank}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {v.logo_url ? <img src={v.logo_url} className="h-7 w-7 rounded-full object-cover" /> : <div className="h-7 w-7 rounded-full bg-secondary/40" />}
                        <span className="font-medium">{v.venue_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{v.city || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{v.count}</td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ color: ORANGE }}>₹{v.spent.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminAnalytics;

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, CalendarCheck, IndianRupee, ShieldCheck } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";

type Metric = { label: string; value: string; icon: React.ElementType; color: string; bg: string };

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);

  const loadData = useCallback(async () => {
    const [{ count: userCount }, { count: bookingCount }, { count: verifyCount }, { data: bookings }] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }).in("status", ["confirmed", "pending"]),
      supabase.from("verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("bookings").select("amount, created_at, date"),
    ]);

    const gmv = (bookings || []).reduce((sum, b) => sum + (b.amount || 0), 0);

    setMetrics([
      { label: "Total Users", value: String(userCount || 0), icon: Users, color: "text-primary", bg: "bg-primary/10" },
      { label: "Active Bookings", value: String(bookingCount || 0), icon: CalendarCheck, color: "text-accent", bg: "bg-accent/10" },
      { label: "GMV This Month", value: `₹${gmv.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-success", bg: "bg-success/10" },
      { label: "Pending Verifications", value: String(verifyCount || 0), icon: ShieldCheck, color: "text-[hsl(174,95%,32%)]", bg: "bg-[hsl(174,95%,32%)]/10" },
    ]);

    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      days[format(subDays(new Date(), i), "MMM dd")] = 0;
    }
    (bookings || []).forEach(b => {
      const d = format(new Date(b.created_at), "MMM dd");
      if (d in days) days[d]++;
    });
    setChartData(Object.entries(days).map(([date, count]) => ({ date, count })));
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-card rounded-card border border-card-border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] text-muted-foreground font-medium">{m.label}</span>
              <div className={`h-9 w-9 rounded-lg ${m.bg} flex items-center justify-center`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
            </div>
            <span className="text-4xl font-display font-bold text-foreground">{m.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-card border border-card-border p-5">
        <h2 className="text-base font-display font-semibold text-foreground mb-4">Daily Bookings (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminDashboard;

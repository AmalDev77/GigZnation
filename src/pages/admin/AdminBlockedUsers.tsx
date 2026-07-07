import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldBan } from "lucide-react";
import { format } from "date-fns";

const AdminBlockedUsers = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("blocked_users")
        .select("*")
        .order("blocked_at", { ascending: false });
      setRows(data || []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldBan className="h-6 w-6 text-destructive" />
        <h1 className="text-2xl font-display font-bold text-foreground">Blocked Users</h1>
      </div>

      <div className="bg-card rounded-xl border border-card-border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">No blocked users.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground">User ID</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Reason</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Blocked At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-card-border">
                  <td className="px-4 py-3 font-mono text-xs">{r.user_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-3">{r.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === "active" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(r.blocked_at), "dd MMM yyyy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminBlockedUsers;

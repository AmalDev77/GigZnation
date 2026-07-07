import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Request = {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  city: string | null;
  document_urls: string[];
  status: string;
  created_at: string;
};

const AdminVerification = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [searchCity, setSearchCity] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("verification_requests").select("*").order("created_at", { ascending: false });
    if (filterRole !== "all") query = query.eq("role", filterRole);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (searchCity) query = query.ilike("city", `%${searchCity}%`);
    const { data } = await query;
    setRequests((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterRole, filterStatus, searchCity]);

  const handleAction = async (id: string, status: "approved" | "rejected", userId: string, role: string) => {
    setActing(id);
    const { data: { session } } = await supabase.auth.getSession();

    await supabase.from("verification_requests").update({
      status,
      reviewed_by: session?.user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    // If approved, mark profile as verified
    if (status === "approved") {
      if (role === "artist") {
        await supabase.from("artist_profiles").update({ verified: true }).eq("user_id", userId);
      } else if (role === "venue") {
        await supabase.from("venue_profiles").update({ verified: true }).eq("user_id", userId);
      }
    }

    // Audit log
    await supabase.from("audit_log").insert({
      admin_id: session!.user.id,
      action: `verification_${status}`,
      target_type: "verification_request",
      target_id: id,
      details: { user_id: userId, role },
    });

    toast.success(`Request ${status}`);
    setActing(null);
    load();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">User Verification</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="artist">Artist</SelectItem>
            <SelectItem value="venue">Venue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Filter by city..." value={searchCity} onChange={e => setSearchCity(e.target.value)} className="w-48" />
      </div>

      {/* Table */}
      <div className="bg-card rounded-card border border-card-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">City</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Submitted</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Docs</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No verification requests found</td></tr>
              ) : requests.map(r => (
                <tr key={r.id} className="border-b border-card-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {(r.full_name || "U")[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{r.full_name || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.role}</td>
                  <td className="px-4 py-3">{r.city || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(r.created_at), "dd MMM yyyy")}</td>
                  <td className="px-4 py-3">{(r.document_urls as any[])?.length || 0} files</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-success hover:bg-success/90 text-white h-8 gap-1"
                          onClick={() => handleAction(r.id, "approved", r.user_id, r.role)}
                          disabled={acting === r.id}
                        >
                          {acting === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 gap-1"
                          onClick={() => handleAction(r.id, "rejected", r.user_id, r.role)}
                          disabled={acting === r.id}
                        >
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminVerification;

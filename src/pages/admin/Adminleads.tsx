import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Music, Building2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  type: "artist" | "venue";
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-info/10 text-info",
  contacted: "bg-orange-100 text-orange-700",
  converted: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const AdminLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "artist" | "venue">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<"artist" | "venue">("artist");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads((data as Lead[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setType("artist"); setFullName(""); setEmail(""); setPhone(""); setCity(""); setNotes("");
  };

  const handleAdd = async () => {
    if (!fullName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("leads").insert({
      type,
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      city: city.trim() || null,
      notes: notes.trim() || null,
      added_by: session?.user.id,
    });
    setSaving(false);
    if (error) { toast.error("Failed to add lead"); console.error(error); return; }
    toast.success("Lead added");
    setShowAdd(false);
    resetForm();
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("leads").update({ status }).eq("id", id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const filtered = leads.filter((l) => filter === "all" || l.type === filter);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Artists and venues who reached out directly. Log them here and track follow-up.
          </p>
        </div>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a new lead</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as "artist" | "venue")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="artist">Artist</SelectItem>
                    <SelectItem value="venue">Venue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Full name / Business name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How they reached out, what they're looking for..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Lead"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "artist", "venue"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium capitalize transition",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-10 text-center text-sm text-muted-foreground">
          No leads yet. Add one when an artist or venue contacts you directly.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <div key={lead.id} className="rounded-xl border border-card-border bg-card p-4 flex items-start gap-4">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                lead.type === "artist" ? "bg-primary/10 text-primary" : "bg-info/10 text-info"
              )}>
                {lead.type === "artist" ? <Music size={18} /> : <Building2 size={18} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display font-semibold text-sm text-foreground">{lead.full_name}</p>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", STATUS_STYLES[lead.status])}>
                    {lead.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(lead.created_at), "d MMM yyyy")}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                  {lead.email && <span className="flex items-center gap-1"><Mail size={11} />{lead.email}</span>}
                  {lead.phone && <span className="flex items-center gap-1"><Phone size={11} />{lead.phone}</span>}
                  {lead.city && <span className="flex items-center gap-1"><MapPin size={11} />{lead.city}</span>}
                </div>
                {lead.notes && <p className="text-xs text-muted-foreground mt-2">{lead.notes}</p>}
              </div>

              <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        Note: this logs contact details for follow-up. To actually create a login for them, use the
        "Invite" flow (see <code>supabase/functions/admin-create-user</code>) once that function is deployed
        with your Supabase service role key.
      </p>
    </div>
  );
};

export default AdminLeads;
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VENUE_TYPES = ["Resto-bar", "Café", "Event Space", "Club", "Corporate"];

interface Props {
  venueType: string | null;
  capacity: number | null;
  hoursStart: string | null;
  hoursEnd: string | null;
  onSave: (fields: Record<string, any>) => void;
}

const VenueDetailsSection = ({ venueType, capacity, hoursStart, hoursEnd, onSave }: Props) => {
  const [localCap, setLocalCap] = useState(capacity?.toString() || "");
  const [localStart, setLocalStart] = useState(hoursStart || "");
  const [localEnd, setLocalEnd] = useState(hoursEnd || "");

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Venue Details</h3>

      <Select
        value={venueType || ""}
        onValueChange={(val) => onSave({ venue_type: val })}
      >
        <SelectTrigger className="rounded-btn">
          <SelectValue placeholder="Select venue type" />
        </SelectTrigger>
        <SelectContent>
          {VENUE_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="number"
        placeholder="Seating Capacity"
        value={localCap}
        onChange={(e) => setLocalCap(e.target.value)}
        onBlur={() => onSave({ capacity: localCap ? parseInt(localCap, 10) : null })}
        className="rounded-btn"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-body text-xs text-muted-foreground">Opens at</label>
          <Input
            type="time"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            onBlur={() => onSave({ operating_hours_start: localStart || null })}
            className="rounded-btn"
          />
        </div>
        <div className="space-y-1">
          <label className="font-body text-xs text-muted-foreground">Closes at</label>
          <Input
            type="time"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            onBlur={() => onSave({ operating_hours_end: localEnd || null })}
            className="rounded-btn"
          />
        </div>
      </div>
    </section>
  );
};

export default VenueDetailsSection;

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  description: string | null;
  venueName: string | null;
  city: string | null;
  area: string | null;
  onSave: (fields: Record<string, string | null>) => void;
}

const MAX_DESC = 400;

const VenueAboutSection = ({ description, venueName, city, area, onSave }: Props) => {
  const [localDesc, setLocalDesc] = useState(description || "");
  const [localName, setLocalName] = useState(venueName || "");
  const [localCity, setLocalCity] = useState(city || "");
  const [localArea, setLocalArea] = useState(area || "");

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Basic Info</h3>
      <Input
        placeholder="Venue Name"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={() => onSave({ venue_name: localName || null })}
        className="rounded-btn"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="City"
          value={localCity}
          onChange={(e) => setLocalCity(e.target.value)}
          onBlur={() => onSave({ city: localCity || null })}
          className="rounded-btn"
        />
        <Input
          placeholder="Area / Locality"
          value={localArea}
          onChange={(e) => setLocalArea(e.target.value)}
          onBlur={() => onSave({ area: localArea || null })}
          className="rounded-btn"
        />
      </div>

      <h3 className="font-display font-bold text-base text-foreground pt-2">About</h3>
      <div className="relative">
        <textarea
          placeholder="Describe your venue..."
          value={localDesc}
          maxLength={MAX_DESC}
          onChange={(e) => setLocalDesc(e.target.value)}
          onBlur={() => onSave({ description: localDesc || null })}
          className="w-full min-h-[120px] rounded-btn border border-input bg-background px-3 py-2 font-body text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="absolute bottom-2 right-3 font-body text-[11px] text-muted-foreground">
          {localDesc.length}/{MAX_DESC}
        </span>
      </div>
    </section>
  );
};

export default VenueAboutSection;

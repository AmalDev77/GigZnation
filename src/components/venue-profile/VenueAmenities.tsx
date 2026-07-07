import { Switch } from "@/components/ui/switch";
import { Volume2, Theater, Mic, Guitar, Monitor, DoorOpen, CarFront } from "lucide-react";
import { cn } from "@/lib/utils";

const AMENITY_LIST = [
  { key: "sound_system", label: "Sound System", icon: Volume2 },
  { key: "stage", label: "Stage", icon: Theater },
  { key: "microphone", label: "Microphone", icon: Mic },
  { key: "backline", label: "Backline", icon: Guitar },
  { key: "projector", label: "Projector", icon: Monitor },
  { key: "green_room", label: "Green Room", icon: DoorOpen },
  { key: "parking", label: "Parking", icon: CarFront },
];

interface Props {
  amenities: Record<string, boolean>;
  onUpdate: (amenities: Record<string, boolean>) => void;
}

const VenueAmenities = ({ amenities, onUpdate }: Props) => {
  const toggle = (key: string) => {
    onUpdate({ ...amenities, [key]: !amenities[key] });
  };

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Stage & Technical Setup</h3>
      <div className="rounded-xl border border-card-border bg-card divide-y divide-card-border">
        {AMENITY_LIST.map(({ key, label, icon: Icon }) => {
          const on = !!amenities[key];
          return (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon size={18} className={cn(on ? "text-info" : "text-muted-foreground/50")} />
                <span className={cn("font-body text-sm", on ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
              <Switch
                checked={on}
                onCheckedChange={() => toggle(key)}
                className="data-[state=checked]:bg-info"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default VenueAmenities;

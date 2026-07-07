import { useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  bio: string | null;
  stageName: string | null;
  city: string | null;
  genre: string | null;
  onSave: (fields: Record<string, string | null>) => void;
  readOnly?: boolean;
}

const BioSection = ({ bio, stageName, city, genre, onSave, readOnly }: Props) => {
  const [localBio, setLocalBio] = useState(bio || "");
  const [localName, setLocalName] = useState(stageName || "");
  const [localCity, setLocalCity] = useState(city || "");
  const [localGenre, setLocalGenre] = useState(genre || "");

  const MAX_BIO = 300;

  if (readOnly) {
    return (
      <section className="space-y-2">
        <h3 className="font-display font-bold text-base text-foreground">About</h3>
        <p className="font-body text-sm text-muted-foreground leading-relaxed">
          {bio || "No bio yet."}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Basic Info</h3>
      <Input
        placeholder="Stage Name"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={() => onSave({ stage_name: localName || null })}
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
          placeholder="Genre"
          value={localGenre}
          onChange={(e) => setLocalGenre(e.target.value)}
          onBlur={() => onSave({ genre: localGenre || null })}
          className="rounded-btn"
        />
      </div>

      <div className="relative">
        <textarea
          placeholder="Write your bio..."
          value={localBio}
          maxLength={MAX_BIO}
          onChange={(e) => setLocalBio(e.target.value)}
          onBlur={() => onSave({ bio: localBio || null })}
          className="w-full min-h-[100px] rounded-btn border border-input bg-background px-3 py-2 font-body text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="absolute bottom-2 right-3 font-body text-[11px] text-muted-foreground">
          {localBio.length}/{MAX_BIO}
        </span>
      </div>
    </section>
  );
};

export default BioSection;

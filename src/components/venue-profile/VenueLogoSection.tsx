import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera } from "lucide-react";
import { toast } from "sonner";

interface Props {
  logoUrl: string | null;
  venueName: string | null;
  userId: string;
  onUpdate: (url: string) => void;
}

const VenueLogoSection = ({ logoUrl, venueName, userId, onUpdate }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `${userId}/logo.${ext}`;
    const { error } = await supabase.storage.from("venue-media").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); console.error(error); return; }
    const { data: { publicUrl } } = supabase.storage.from("venue-media").getPublicUrl(path);
    onUpdate(publicUrl);
    toast.success("Logo updated");
  };

  const initial = (venueName || "V")[0].toUpperCase();

  return (
    <div className="flex justify-center -mt-10 relative z-10">
      <div className="relative">
        <div className="h-20 w-20 rounded-full border-[3px] border-white overflow-hidden bg-info/10 flex items-center justify-center shadow-lg">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-display font-bold text-info">{initial}</span>
          )}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-info flex items-center justify-center border-2 border-white"
        >
          <Camera size={12} className="text-info-foreground" />
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
};

export default VenueLogoSection;

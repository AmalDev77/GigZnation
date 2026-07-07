import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera } from "lucide-react";
import { toast } from "sonner";

interface Props {
  avatarUrl: string | null;
  stageName: string | null;
  userId: string;
  onUpdate: (url: string) => void;
  readOnly?: boolean;
}

const AvatarSection = ({ avatarUrl, stageName, userId, onUpdate, readOnly }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from("artist-media").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); console.error(error); return; }
    const { data: { publicUrl } } = supabase.storage.from("artist-media").getPublicUrl(path);
    onUpdate(publicUrl);
    toast.success("Avatar updated");
  };

  const initial = (stageName || "A")[0].toUpperCase();

  return (
    <div className="flex justify-center -mt-10 relative z-10">
      <div className="relative">
        <div className="h-20 w-20 rounded-full border-[3px] border-white overflow-hidden bg-primary/10 flex items-center justify-center shadow-lg">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-display font-bold text-primary">{initial}</span>
          )}
        </div>
        {!readOnly && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center border-2 border-white"
            >
              <Camera size={12} className="text-primary-foreground" />
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </>
        )}
      </div>
    </div>
  );
};

export default AvatarSection;

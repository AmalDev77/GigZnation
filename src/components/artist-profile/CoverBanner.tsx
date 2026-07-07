import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface Props {
  coverUrl: string | null;
  userId: string;
  onUpdate: (url: string) => void;
  readOnly?: boolean;
}

const CoverBanner = ({ coverUrl, userId, onUpdate, readOnly }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `${userId}/cover.${ext}`;
    const { error } = await supabase.storage.from("artist-media").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); console.error(error); return; }
    const { data: { publicUrl } } = supabase.storage.from("artist-media").getPublicUrl(path);
    onUpdate(publicUrl);
    toast.success("Cover updated");
  };

  return (
    <div className="relative h-[200px] w-full overflow-hidden">
      {coverUrl ? (
        <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-primary/30" />
      )}
      {/* Purple gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/60 to-primary/90" />

      {!readOnly && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute top-12 right-4 h-8 w-8 rounded-full bg-background/30 backdrop-blur flex items-center justify-center"
          >
            <Pencil size={14} className="text-primary-foreground" />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </>
      )}
    </div>
  );
};

export default CoverBanner;

import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  mediaUrls: string[];
  userId: string;
  onUpdate: (urls: string[]) => void;
  readOnly?: boolean;
}

const SLOTS = 6;

const MediaGallery = ({ mediaUrls, userId, onUpdate, readOnly }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mediaUrls.length >= SLOTS) { toast.error("Maximum 6 items"); return; }

    const ext = file.name.split(".").pop();
    const path = `${userId}/media/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("artist-media").upload(path, file);
    if (error) { toast.error("Upload failed"); console.error(error); return; }
    const { data: { publicUrl } } = supabase.storage.from("artist-media").getPublicUrl(path);
    onUpdate([...mediaUrls, publicUrl]);
    toast.success("Media added");
  };

  const handleRemove = (idx: number) => {
    const updated = mediaUrls.filter((_, i) => i !== idx);
    onUpdate(updated);
  };

  const slots = Array.from({ length: SLOTS }, (_, i) => mediaUrls[i] || null);

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Media Gallery</h3>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((url, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-xl border border-card-border bg-card overflow-hidden flex items-center justify-center"
          >
            {url ? (
              <>
                {url.match(/\.(mp4|webm|mov)$/i) ? (
                  <video src={url} className="h-full w-full object-cover" />
                ) : (
                  <img src={url} alt={`Media ${i + 1}`} className="h-full w-full object-cover" />
                )}
                {!readOnly && (
                  <button
                    onClick={() => handleRemove(i)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/90 flex items-center justify-center"
                  >
                    <X size={10} className="text-destructive-foreground" />
                  </button>
                )}
              </>
            ) : !readOnly ? (
              <button
                onClick={() => inputRef.current?.click()}
                className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition"
              >
                <Plus size={20} />
                <span className="text-[10px]">Add</span>
              </button>
            ) : (
              <div className="text-muted-foreground/30 text-xs">Empty</div>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
      )}
    </section>
  );
};

export default MediaGallery;

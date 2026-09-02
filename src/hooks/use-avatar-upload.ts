import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export function useAvatarUpload({
  uploadFn,
  onSuccess,
  auditLabel,
}: {
  uploadFn: (file: File) => Promise<void>;
  onSuccess?: () => void;
  auditLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onFile = useCallback(
    async (f: File | undefined) => {
      if (!f || busy) return;
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) {
        toast.error("Please choose a PNG, JPEG, WebP, or GIF image");
        return;
      }
      if (f.size > 2 * 1024 * 1024) {
        toast.error("Please choose an image under 2 MB");
        return;
      }
      setPreview(URL.createObjectURL(f));
      setBusy(true);
      try {
        await uploadFn(f);
        setPreview(null);
        onSuccess?.();
        toast.success("Avatar updated");
      } catch (err) {
        setPreview(null);
        toast.error(err instanceof Error ? err.message : "Upload failed — please try again");
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [busy, uploadFn, onSuccess, auditLabel],
  );

  return { busy, preview, fileRef, onFile };
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip, Upload, X } from "lucide-react";
import {
  type Attachment,
  formatFileSize,
  materialHref,
  uploadCourseMaterial,
  attachCourseMaterial,
  removeCourseMaterial,
} from "@/lib/lms";
import { cn } from "@/lib/utils";
import { ACCEPTED, MAX_FILE_BYTES } from "./constants";

export function MaterialManager({
  target,
  id,
  courseId,
  attachments,
}: {
  target: "quiz" | "assignment";
  id: string;
  courseId: string;
  attachments: Attachment[];
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<Attachment[]>(attachments);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [target === "quiz" ? "quizzes" : "assignments"] });

  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name} is over 25 MB.`);
          continue;
        }
        const attachment = await uploadCourseMaterial(courseId, file);
        setItems(await attachCourseMaterial(target, id, attachment));
        toast.success(`${file.name} attached.`);
      }
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      setDrag(false);
    }
  };

  const detach = async (a: Attachment) => {
    setBusy(true);
    try {
      setItems(await removeCourseMaterial(target, id, a.path));
      toast.success("File removed.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-dashed border-border p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" /> Materials
      </div>
      {items.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {items.map((a) => (
            <li
              key={a.path}
              className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5"
            >
              <a
                href={materialHref(a)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-xs font-medium text-primary hover:underline"
              >
                {a.name}
              </a>
              <span className="text-[11px] text-muted-foreground">{formatFileSize(a.size)}</span>
              <button
                onClick={() => detach(a)}
                disabled={busy}
                aria-label={`Remove ${a.name}`}
                className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
        className={cn(
          "mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs font-medium transition",
          drag
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:bg-muted",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? "Uploading…" : "Drop files here or browse — PDF, DOCX, PNG, JPG, ZIP (Max: 25MB)"}
        <input
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          aria-label="Upload course material"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

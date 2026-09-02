import { useRef, useState } from "react";
import { toast } from "sonner";
import { CloudUpload, FileText, X } from "lucide-react";
import { formatFileSize } from "@/lib/lms";
import { cn } from "@/lib/utils";
import { ACCEPTED, MAX_FILE_BYTES, MAX_BATCH_BYTES, isAcceptedFile } from "./constants";

export function PendingDropzone({
  files,
  onChange,
  progress,
  busy,
}: {
  files: File[];
  onChange: (next: File[]) => void;
  progress?: number;
  busy?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const add = (incoming: FileList | File[]) => {
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (!isAcceptedFile(file)) {
        toast.error(`${file.name} is not a supported format.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is over 25 MB.`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      if (next.reduce((s, f) => s + f.size, 0) + file.size > MAX_BATCH_BYTES) {
        toast.error("Batch is too large (max 60 MB total).");
        break;
      }
      next.push(file);
    }
    onChange(next);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Attach reference materials"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) add(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-5 text-center transition",
          drag
            ? "border-primary bg-primary/10 ring-2 ring-primary/40"
            : "border-border hover:border-primary/50 hover:bg-muted/60",
        )}
      >
        <CloudUpload className={cn("h-6 w-6", drag ? "text-primary" : "text-muted-foreground")} />
        <p className="text-sm font-semibold">Drag and drop files here, or browse</p>
        <p className="text-xs text-muted-foreground">
          Supports PDF, DOCX, PNG, JPG, ZIP (Max: 25MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          aria-label="Reference materials"
          onChange={(e) => {
            if (e.target.files?.length) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {files.map((f) => (
            <li
              key={`${f.name}-${f.size}`}
              className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{f.name}</span>
              <span className="text-[11px] text-muted-foreground">{formatFileSize(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x !== f))}
                disabled={busy}
                aria-label={`Remove ${f.name}`}
                className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy && typeof progress === "number" && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

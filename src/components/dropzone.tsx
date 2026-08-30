import { useRef, useState } from "react";
import { CloudUpload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/lms";

const MAX_BYTES = 25 * 1024 * 1024;

export interface DropzoneProps {
  files: File[];
  onChange: (next: File[]) => void;
  accept?: string;
  maxBytes?: number;
  className?: string;
}

/**
 * Reusable file dropzone — 25MB per-file cap, dedupes by name+size.
 * Used by assignment/worksheet upload placeholders.
 */
export function Dropzone({
  files,
  onChange,
  accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip",
  maxBytes = MAX_BYTES,
  className,
}: DropzoneProps) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);

  const add = (incoming: FileList | File[]) => {
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (f.size > maxBytes) {
        toast.error(`${f.name} is too large (max ${formatFileSize(maxBytes)} each).`);
        continue;
      }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    onChange(next);
  };

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Attach files"
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            ref.current?.click();
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
          drag ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-border hover:border-primary/50 hover:bg-muted/60",
        )}
      >
        <CloudUpload className={cn("h-6 w-6", drag ? "text-primary" : "text-muted-foreground")} />
        <p className="text-sm font-semibold">Drag and drop files here, or browse</p>
        <p className="text-xs text-muted-foreground">Up to {formatFileSize(maxBytes)} each</p>
        <input
          ref={ref}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          aria-label="File input"
          onChange={(e) => {
            if (e.target.files?.length) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{f.name}</span>
              <span className="text-[11px] text-muted-foreground">{formatFileSize(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x !== f))}
                aria-label={`Remove ${f.name}`}
                className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Dropzone;

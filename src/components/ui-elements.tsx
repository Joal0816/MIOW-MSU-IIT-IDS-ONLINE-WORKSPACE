import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";
import { MiowWatermark } from "@/components/brand";
import { useTheme } from "@/hooks";
import type { AttendanceStatus } from "@/lib/lms";

/* ---------- Course accent palette ---------- */

export const COURSE_STYLE: Record<string, { chip: string; soft: string; bar: string }> = {
  indigo: {
    chip: "bg-indigo-600",
    soft: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    bar: "bg-indigo-500",
  },
  emerald: {
    chip: "bg-emerald-600",
    soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  sky: {
    chip: "bg-sky-600",
    soft: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  amber: {
    chip: "bg-amber-500",
    soft: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  rose: {
    chip: "bg-rose-600",
    soft: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    bar: "bg-rose-500",
  },
  violet: {
    chip: "bg-violet-600",
    soft: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "bg-violet-500",
  },
};

const FALLBACK_STYLE = COURSE_STYLE["indigo"]!;

export function courseStyle(color: string) {
  return COURSE_STYLE[color] ?? FALLBACK_STYLE;
}

/* ---------- Theme toggle ---------- */

export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground backdrop-blur-md transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "moon" : "sun"}
          initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.18 }}
          className="flex"
        >
          {dark ? (
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ---------- Primitives ---------- */

const TONES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

export function Badge({ tone = "slate", children }: { tone?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONES[tone] ?? TONES["slate"],
      )}
    >
      {children}
    </span>
  );
}

export function attendanceTone(status: AttendanceStatus): { tone: string; label: string } {
  if (status === "late") return { tone: "amber", label: "Late" };
  if (status === "excused") return { tone: "violet", label: "Excused" };
  return { tone: "green", label: "On time" };
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card/75 shadow-card backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MotionCard({
  className,
  children,
  delay = 0,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  delay?: number;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border/70 bg-card/75 shadow-card backdrop-blur-md",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ProgressBar({ value, barClass }: { value: number; barClass?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className={cn("h-full rounded-full bg-primary", barClass)}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  sub,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center backdrop-blur-sm">
      <div className="text-muted-foreground">{icon}</div>
      <p className="font-semibold">{title}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  counts,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-muted/80 p-1 backdrop-blur-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {counts && counts[o.value] != null && (
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">
              {counts[o.value]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------- Camera panel ---------- */

export function CameraPanel({
  scanning = false,
  videoRef,
  className,
}: {
  scanning?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}) {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const ref = videoRef ?? internalRef;
  const [live, setLive] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" } })
      .then((s: MediaStream) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (ref.current) {
          ref.current.srcObject = s;
          setLive(true);
        }
      })
      .catch(() => setLive(false));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [ref]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-slate-900",
        className,
      )}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={cn("h-full w-full object-cover", !live && "hidden")}
      />
      {!live && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
          <ScanFace className="h-10 w-10" />
          <p className="text-xs">Camera preview (simulated)</p>
        </div>
      )}
      <MiowWatermark />
      {scanning && (
        <>
          <div className="absolute left-0 h-1 w-full animate-scanline bg-emerald-400/90 shadow-[0_0_18px_4px_rgba(52,211,153,0.7)]" />
          <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-emerald-300/70" />
          <div className="pointer-events-none absolute inset-10 animate-pulse-ring rounded-full border-2 border-emerald-300/50" />
        </>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border/70 bg-card/95 p-6 shadow-lift backdrop-blur-xl",
              wide ? "max-w-3xl" : "max-w-lg",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { cn } from "@/lib/utils";
import { APP_DESCRIPTOR, APP_SHORT_NAME } from "@/lib/brand";

/**
 * MIOW logomark — geometric MSU-IIT peak (maroon) with a gold data node and
 * concentric RFID waves. Pure vector so it stays legible from 16px favicons up
 * to hero lockups, and readable on light and dark themes.
 */
export function MiowMark({
  className,
  plate = true,
}: {
  className?: string;
  /** Draw the navy rounded plate behind the peak (badge use). */
  plate?: boolean;
}) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("h-8 w-8", className)}>
      {plate && <rect width="64" height="64" rx="14" fill="#0D1B2A" />}
      <g transform="skewX(-5)">
        <path d="M33 9 L54 55 H44 L32 28 L20 55 H10 Z" fill="#800000" />
        <path d="M33 9 L54 55 H49.5 L31.5 18 Z" fill="#9A1B1B" />
      </g>
      <circle cx="32" cy="24" r="4" fill="#FFD700" />
      <path
        d="M23 33 a11 11 0 0 1 18 0"
        fill="none"
        stroke="#FFD700"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M17.5 39 a17 17 0 0 1 29 0"
        fill="none"
        stroke="#FFD700"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

/** "MIOW" wordmark + official descriptor, with I D S emphasised. */
export function MiowWordmark({
  className,
  size = "md",
  descriptor = true,
  tone = "default",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  descriptor?: boolean;
  tone?: "default" | "sidebar";
}) {
  const word = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }[size];
  const desc = { sm: "text-[9px]", md: "text-[10px]", lg: "text-[11px]" }[size];
  return (
    <div className={cn("min-w-0", className)}>
      <p
        className={cn(
          "font-display font-extrabold leading-none tracking-[0.08em]",
          word,
          tone === "sidebar" ? "text-sidebar-foreground" : "text-foreground",
        )}
      >
        {APP_SHORT_NAME}
      </p>
      {descriptor && (
        <p
          className={cn(
            "mt-1 truncate uppercase leading-none tracking-[0.16em]",
            desc,
            tone === "sidebar" ? "text-sidebar-foreground/60" : "text-muted-foreground",
          )}
        >
          MSU-IIT{" "}
          <span
            className={cn(
              "font-bold",
              tone === "sidebar" ? "text-[#FFD700]" : "text-[#800000] dark:text-[#e8b4b4]",
            )}
          >
            I&thinsp;D&thinsp;S
          </span>{" "}
          ONLINE WORKSPACE
        </p>
      )}
    </div>
  );
}

/** Full horizontal lockup: peak icon + wordmark + descriptor. */
export function MiowLockup({
  className,
  size = "md",
  descriptor = true,
  tone = "default",
  subLabel,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  descriptor?: boolean;
  tone?: "default" | "sidebar";
  /** Optional refined label under the lockup, e.g. "Admin Console". */
  subLabel?: string;
}) {
  const icon = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" }[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <MiowMark className={cn("shrink-0 rounded-xl shadow-lift", icon)} />
      <div className="min-w-0">
        <MiowWordmark size={size} descriptor={descriptor} tone={tone} />
        {subLabel && (
          <p
            className={cn(
              "mt-1 truncate text-xs font-semibold",
              tone === "sidebar" ? "text-sidebar-foreground/70" : "text-muted-foreground",
            )}
          >
            {subLabel}
          </p>
        )}
      </div>
    </div>
  );
}

/** Low-opacity identity watermark for surfaces. */
export function MiowWatermark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1 opacity-60 backdrop-blur-sm",
        className,
      )}
    >
      <MiowMark plate={false} className="h-4 w-4" />
      <span className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-white">
        {APP_SHORT_NAME}
      </span>
      <span className="sr-only">{APP_DESCRIPTOR}</span>
    </div>
  );
}

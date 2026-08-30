import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  ScanFace,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import {
  dashboardPathFor,
  loadSession,
  refreshSessionProfile,
  saveSession,
  subscribeProfile,
  type AttendanceStatus,
  type Profile,
  type Role,
} from "@/lib/lms";
import { cn } from "@/lib/utils";
import { MiowMark, MiowWordmark, MiowWatermark } from "@/components/brand";
import { ChatWidget } from "@/components/chat-widget";

/* ---------- Session hook (mock hardware-auth demo) ---------- */

export function useProfile(roles?: Role[]): Profile | null {
  // Load the session after hydration: localStorage doesn't exist during SSR,
  // so reading it in a useState initializer causes a hydration mismatch.
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();
  const roleKey = roles?.join(",") ?? "";
  useEffect(() => {
    const sync = () => {
      const p = loadSession();
      const allowed = roleKey ? (roleKey.split(",") as Role[]) : undefined;
      if (!p) {
        navigate({ to: "/auth", replace: true });
      } else if (allowed && !allowed.includes(p.role)) {
        // 403-style guard: signed in but not authorized for this portal —
        // send them to their OWN role's home view (e.g. a teacher hitting
        // /dashboard/admin/settings lands on the teacher courses page, and
        // an admin hitting the teacher gradebook returns to the console).
        navigate({ to: dashboardPathFor(p.role), replace: true });
      } else {
        setProfile(p);
      }
    };
    sync();
    // Claims refresh: pull the LIVE profile (role included) from the server
    // so an admin's role change propagates here without re-login. The merged
    // update re-fires the store, and the guard above re-evaluates access —
    // e.g. a demoted teacher is redirected out of the admin console.
    void refreshSessionProfile();
    // Reactive global store: any profile save (same tab) or session write
    // (other tabs) re-syncs, so the sidebar/navbar profile card never shows
    // a stale name, avatar, or role after an update — no refresh needed.
    return subscribeProfile(sync);
  }, [roleKey, navigate]);
  return profile;
}

export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return () => {
    saveSession(null);
    // Purge every cached server record so the next kiosk session always
    // starts from fresh data.
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  };
}

/* ---------- Theme (dark / light) ---------- */

const THEME_KEY = "northview-theme";

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);
  return { dark, toggle };
}

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
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ---------- Course accent palette (single source) ---------- */

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

/** Card with Framer Motion entrance + hover lift. */
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

export function EmptyState({ icon, title, sub }: { icon?: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center backdrop-blur-sm">
      <div className="text-muted-foreground">{icon}</div>
      <p className="font-semibold">{title}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Pill-style tab switcher used for list filtering. */
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

/* ---------- Shell ---------- */

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export const STUDENT_NAV: NavItem[] = [
  { to: "/dashboard/student", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/dashboard/student/grades", label: "Grades", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/dashboard/student/assignments", label: "Assignments", icon: <ClipboardList className="h-4 w-4" /> },
  { to: "/dashboard/student/quizzes", label: "Worksheets", icon: <FileQuestion className="h-4 w-4" /> },
  { to: "/dashboard/student/attendance", label: "Attendance", icon: <CalendarCheck className="h-4 w-4" /> },
  { to: "/dashboard/student/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

// Admin Console — system-level surfaces only. Gradebook editing and the
// attendance kiosk are teacher duties and are NOT in this nav.
export const ADMIN_NAV: NavItem[] = [
  { to: "/dashboard/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/dashboard/admin/students", label: "Students", icon: <Users className="h-4 w-4" /> },
  { to: "/dashboard/admin/teachers", label: "Teachers", icon: <GraduationCap className="h-4 w-4" /> },

  { to: "/dashboard/admin/courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
  { to: "/dashboard/admin/announcements", label: "Announcements", icon: <Megaphone className="h-4 w-4" /> },
  { to: "/dashboard/admin/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

// Teacher Portal — classroom surfaces only. Admin settings, user/role
// management, and the student registry are NOT in this nav.
export const TEACHER_NAV: NavItem[] = [
  { to: "/dashboard/admin/courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
  { to: "/dashboard/admin/grades", label: "Gradebook", icon: <Layers className="h-4 w-4" /> },
  { to: "/dashboard/admin/attendance", label: "Attendance Kiosk", icon: <CalendarCheck className="h-4 w-4" /> },
  { to: "/dashboard/admin/announcements", label: "Announcements", icon: <Megaphone className="h-4 w-4" /> },
  { to: "/dashboard/teacher/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

/** Sidebar nav for a staff member, keyed by their exact role. */
export function staffNav(role: Role): NavItem[] {
  return role === "admin" ? ADMIN_NAV : TEACHER_NAV;
}

/** Self-service settings route for a role — used by the header/profile pill. */
export function settingsPathFor(role: Role): string {
  if (role === "admin") return "/dashboard/admin/settings";
  if (role === "teacher") return "/dashboard/teacher/settings";
  return "/dashboard/student/settings";
}


const SIDEBAR_KEY = "northview-sidebar-collapsed";

function Breadcrumbs({ nav, subtitle }: { nav: NavItem[]; subtitle: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = nav.find((n) => n.to === pathname);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <span className="font-medium text-muted-foreground">{subtitle}</span>
      {current && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="font-semibold text-foreground">{current.label}</span>
        </>
      )}
    </nav>
  );
}

export function AppShell({
  nav,
  profile,
  subtitle,
  children,
}: {
  nav: NavItem[];
  profile: Profile;
  subtitle: string;
  children: ReactNode;
}) {
  const signOut = useSignOut();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const links = nav.map((n) => {
    const active = pathname === n.to;
    return (
    <Link
      key={n.to}
      to={n.to}
      title={collapsed ? n.label : undefined}
      aria-label={n.label}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lift"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      {n.icon}
      {!collapsed && <span className="truncate">{n.label}</span>}
      {active && !collapsed && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-y-1 left-0 w-1 rounded-full bg-sidebar-primary-foreground/70"
        />
      )}
    </Link>
    );
  });

  return (
    <div className="relative min-h-screen bg-background lg:flex">
      {/* Decorative gradient wash so the frosted cards have something to blur */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/10" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[26rem] w-[26rem] rounded-full bg-sky-400/10 blur-3xl dark:bg-violet-500/10" />
      </div>

      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-sidebar p-4 transition-[width] duration-300 lg:sticky lg:top-0 lg:flex lg:min-h-screen",
          collapsed ? "w-[84px]" : "w-64",
        )}
      >
        <div className={cn("mb-6 flex items-center gap-2.5 px-2 pt-2", collapsed && "justify-center px-0")}>
          <MiowMark className="h-9 w-9 shrink-0 rounded-xl shadow-lift" />
          {!collapsed && (
            <div className="min-w-0">
              <MiowWordmark size="sm" tone="sidebar" />
              <p className="mt-1 truncate text-xs font-semibold text-sidebar-foreground/70">{subtitle}</p>
            </div>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1">{links}</nav>
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mb-3 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && "Collapse"}
        </button>
        <div className="rounded-xl bg-sidebar-accent/80 p-3">
          <div className={cn("flex items-center gap-2.5", collapsed && "flex-col")}>
            <img
              src={profile.avatar_url ?? ""}
              alt={profile.full_name}
              className="h-9 w-9 rounded-full ring-2 ring-sidebar-primary/40"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{profile.full_name}</p>
                <p className="truncate text-xs capitalize text-sidebar-foreground/60">{profile.role}</p>
              </div>
            )}
            <Link
              to={settingsPathFor(profile.role)}
              title="Settings"
              aria-label="Open settings"
              className="rounded-lg p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-primary/30 hover:text-sidebar-foreground"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-primary/30 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>

          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop topbar: breadcrumbs + theme + profile pill (settings shortcut) */}
        <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-border/60 bg-background/70 px-6 py-3 backdrop-blur-md lg:flex">
          <Breadcrumbs nav={nav} subtitle={subtitle} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to={settingsPathFor(profile.role)}
              aria-label={`Open settings for ${profile.full_name}`}
              title="Settings"
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card/70 py-1 pl-1 pr-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <img
                src={profile.avatar_url ?? ""}
                alt=""
                className="h-7 w-7 rounded-full object-cover ring-1 ring-primary/30"
              />
              <span className="max-w-[10rem] truncate">{profile.full_name}</span>
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>
        </header>

        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md lg:hidden">
          <MiowMark className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="font-display text-sm font-extrabold tracking-[0.08em]">MIOW</p>
            <p className="truncate text-[10px] text-muted-foreground">MSU-IIT IDS</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link
              to={settingsPathFor(profile.role)}
              aria-label="Open settings"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-border/60 bg-background/60 px-4 py-2 backdrop-blur-md lg:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              aria-label={n.label}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold",
                pathname === n.to ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <ChatWidget profile={profile} />
    </div>
  );
}

/* ---------- RFID scanner hook ---------- */

export function useRfidScanner(onScan: (uid: string) => void, enabled = true) {
  const buffer = useRef("");
  const lastKey = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKey.current > 300) buffer.current = "";
      lastKey.current = now;
      if (/^\d$/.test(e.key)) {
        buffer.current += e.key;
      } else if (e.key === "Enter") {
        const uid = buffer.current;
        buffer.current = "";
        if (uid.length >= 10 && uid.length <= 13) onScan(uid);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onScan, enabled]);
}

/* ---------- Camera panel with scanning overlay ---------- */

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
      .then((s) => {
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
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-slate-900", className)}>
      <video ref={ref} autoPlay playsInline muted className={cn("h-full w-full object-cover", !live && "hidden")} />
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

/* ---------- Modal (Framer Motion) ---------- */

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

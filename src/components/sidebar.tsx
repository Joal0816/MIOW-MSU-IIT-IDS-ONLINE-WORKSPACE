import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  Users,
} from "lucide-react";
import type { Profile, Role } from "@/lib/lms";
import { cn } from "@/lib/utils";
import { MiowMark, MiowWordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/ui-elements";
import { useSignOut } from "@/hooks";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export const STUDENT_NAV: NavItem[] = [
  { to: "/dashboard/student", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/dashboard/student/courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
  { to: "/dashboard/student/grades", label: "Grades", icon: <BarChart3 className="h-4 w-4" /> },
  {
    to: "/dashboard/student/assignments",
    label: "Activities",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    to: "/dashboard/student/attendance",
    label: "Attendance",
    icon: <CalendarCheck className="h-4 w-4" />,
  },
  { to: "/dashboard/student/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export const ADMIN_NAV: NavItem[] = [
  { to: "/dashboard/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/dashboard/admin/students", label: "Students", icon: <Users className="h-4 w-4" /> },
  {
    to: "/dashboard/admin/teachers",
    label: "Teachers",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  { to: "/dashboard/admin/courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
  {
    to: "/dashboard/admin/announcements",
    label: "Announcements",
    icon: <Megaphone className="h-4 w-4" />,
  },
  { to: "/dashboard/admin/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export const TEACHER_NAV: NavItem[] = [
  { to: "/dashboard/teacher", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/dashboard/teacher/students", label: "Students", icon: <Users className="h-4 w-4" /> },
  { to: "/dashboard/admin/courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
  {
    to: "/dashboard/admin/announcements",
    label: "Announcements",
    icon: <Megaphone className="h-4 w-4" />,
  },
  { to: "/dashboard/admin/grades", label: "Gradebook", icon: <Layers className="h-4 w-4" /> },
  {
    to: "/dashboard/admin/attendance",
    label: "Attendance",
    icon: <CalendarCheck className="h-4 w-4" />,
  },
  { to: "/dashboard/teacher/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export function staffNav(role: Role): NavItem[] {
  return role === "admin" ? ADMIN_NAV : TEACHER_NAV;
}

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
            className="absolute left-0.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-sidebar-primary-foreground/70"
          />
        )}
      </Link>
    );
  });

  return (
    <div className="relative min-h-screen bg-background lg:flex">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/10" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[26rem] w-[26rem] rounded-full bg-sky-400/10 blur-3xl dark:bg-violet-500/10" />
      </div>

      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-sidebar p-4 transition-[width] duration-300 lg:sticky lg:top-0 lg:flex lg:min-h-screen",
          collapsed ? "w-[84px]" : "w-64",
        )}
      >
        <div
          className={cn(
            "mb-6 flex items-center gap-2.5 px-2 pt-2",
            collapsed && "justify-center px-0",
          )}
        >
          <MiowMark className="h-9 w-9 shrink-0 rounded-xl shadow-lift" />
          {!collapsed && (
            <div className="min-w-0">
              <MiowWordmark size="sm" tone="sidebar" />
              <p className="mt-1 truncate text-xs font-semibold text-sidebar-foreground/70">
                {subtitle}
              </p>
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
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {profile.full_name}
                </p>
                <p className="truncate text-xs capitalize text-sidebar-foreground/60">
                  {profile.role}
                </p>
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
                src={profile.avatar_url || undefined}
                alt=""
                className="h-7 w-7 rounded-full object-cover ring-1 ring-primary/30"
              />
              <span className="max-w-[10rem] truncate">{profile.full_name}</span>
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>
        </header>

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
                pathname === n.to
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

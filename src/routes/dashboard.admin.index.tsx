import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CalendarCheck, Megaphone, Users } from "lucide-react";
import { countRows, fmtTime, listAllAttendance, listStudents } from "@/lib/lms";
import { ADMIN_NAV, AppShell, Badge, Card, useProfile } from "@/components/lms";

export const Route = createFileRoute("/dashboard/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard | MIOW - MSU-IIT IDS Online Workspace" },
      {
        name: "description",
        content: "Campus overview: students, courses, attendance and announcements.",
      },
      { property: "og:title", content: "Admin Dashboard | MIOW - MSU-IIT IDS Online Workspace" },
      {
        property: "og:description",
        content: "Campus overview: students, courses, attendance and announcements.",
      },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const profile = useProfile(["admin"]);
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: listStudents,
    enabled: !!profile,
  });
  const { data: courseCount } = useQuery({
    queryKey: ["count", "courses"],
    queryFn: () => countRows("courses"),
    enabled: !!profile,
  });
  const { data: announcementCount } = useQuery({
    queryKey: ["count", "announcements"],
    queryFn: () => countRows("announcements"),
    enabled: !!profile,
  });
  const { data: logs } = useQuery({
    queryKey: ["attendance-all"],
    queryFn: () => listAllAttendance(50),
    enabled: !!profile,
  });

  if (!profile) return null;

  const today = new Date().toDateString();
  const todayLogs = (logs ?? []).filter((l) => new Date(l.timestamp).toDateString() === today);
  const todayIns = todayLogs.filter((l) => l.scan_type === "in");
  const lateToday = todayIns.filter((l) => l.status === "late").length;
  const nameOf = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  return (
    <AppShell nav={ADMIN_NAV} profile={profile} subtitle="Admin Console">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Campus Overview</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        {new Date().toLocaleDateString("en-PH", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Students
            </p>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{students?.length ?? "—"}</p>
          <Link
            to="/dashboard/admin/students"
            className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Manage <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Courses
            </p>
            <BookOpen className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{courseCount ?? "—"}</p>
          <Link
            to="/dashboard/admin/courses"
            className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Manage <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tapped In Today
            </p>
            <CalendarCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{todayIns.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{lateToday} late</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Announcements
            </p>
            <Megaphone className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{announcementCount ?? "—"}</p>
          <Link
            to="/dashboard/admin/announcements"
            className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Post new <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Live Gate Feed</h2>
          <Link
            to="/dashboard/admin/settings"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Kiosk settings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <Card className="divide-y divide-border">
          {(logs ?? []).slice(0, 10).map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-4">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  l.scan_type === "in"
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-sky-100 text-sky-600"
                }`}
              >
                <CalendarCheck className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {nameOf.get(l.student_id) ?? "Unknown student"}
                </p>
                <p className="text-xs text-muted-foreground">{fmtTime(l.timestamp)}</p>
              </div>
              <Badge
                tone={l.scan_type === "in" ? (l.status === "late" ? "amber" : "green") : "sky"}
              >
                {l.scan_type === "in"
                  ? l.status === "late"
                    ? "IN · Late"
                    : "IN · On time"
                  : "OUT"}
              </Badge>
            </div>
          ))}
          {(logs ?? []).length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No scans recorded yet today.
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

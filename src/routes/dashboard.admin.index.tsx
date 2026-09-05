import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CalendarCheck, Megaphone, Users } from "lucide-react";
import { ATTENDANCE_LIMIT_DASHBOARD } from "@/components/courses/constants";
import { countRows, fmtTime, listAllAttendance, listStudents } from "@/lib/lms";
import { ADMIN_NAV, AppShell, Badge, Card, useProfile } from "@/components/lms";

export const Route = createFileRoute("/dashboard/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard | MIOW - Integrated Developmental School" },
      {
        name: "description",
        content: "Campus overview: students, courses, attendance and announcements.",
      },
      { property: "og:title", content: "Admin Dashboard | MIOW - Integrated Developmental School" },
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
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students"],
    queryFn: listStudents,
    enabled: !!profile,
  });
  const { data: courseCount, isLoading: coursesLoading } = useQuery({
    queryKey: ["count", "courses"],
    queryFn: () => countRows("courses"),
    enabled: !!profile,
  });
  const { data: announcementCount, isLoading: announcementsLoading } = useQuery({
    queryKey: ["count", "announcements"],
    queryFn: () => countRows("announcements"),
    enabled: !!profile,
  });
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["attendance-all"],
    queryFn: () => listAllAttendance(ATTENDANCE_LIMIT_DASHBOARD),
    enabled: !!profile,
  });

  if (!profile) return null;
  const isLoading = studentsLoading || coursesLoading || announcementsLoading || logsLoading;

  const today = new Date().toDateString();
  const todayLogs = (logs ?? []).filter((l) => new Date(l.timestamp).toDateString() === today);
  const todayIns = todayLogs.filter((l) => l.scan_type === "in");
  const lateToday = todayIns.filter((l) => l.status === "late").length;
  const nameOf = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  const firstName = profile.full_name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <AppShell nav={ADMIN_NAV} profile={profile} subtitle="Admin Console">
      {/* Welcome Banner */}
      <div className="mb-8 rounded-2xl bg-sidebar p-7 text-sidebar-foreground relative overflow-hidden">
        <div className="absolute top-[-20px] right-[-20px] h-28 w-28 rounded-full bg-white/5" />
        <div className="absolute bottom-[-30px] right-10 h-20 w-20 rounded-full bg-white/5" />
        <h1 className="font-display text-2xl font-bold relative z-10">
          {greeting}, {firstName} ☀️
        </h1>
        <p className="mt-1 text-sm text-sidebar-foreground/70 relative z-10">
          You have {students?.length ?? "—"} students across {courseCount ?? "—"} courses.
        </p>
        <p className="mt-3 text-xs italic text-sidebar-foreground/40 relative z-10">
          "Education is the most powerful weapon which you can use to change the world." — Nelson
          Mandela
        </p>
      </div>

      {/* Stats Row */}
      {isLoading ? (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 w-20 rounded bg-muted mb-2" />
              <div className="h-8 w-12 rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4 hover:border-accent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Students
              </p>
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-600">
                +{students?.length ?? 0}
              </span>
            </div>
            <p className="font-display text-2xl font-extrabold text-accent-foreground">
              {students?.length ?? "—"}
            </p>
          </Card>
          <Card className="p-4 hover:border-accent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Courses
              </p>
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-600">
                Active
              </span>
            </div>
            <p className="font-display text-2xl font-extrabold">{courseCount ?? "—"}</p>
          </Card>
          <Card className="p-4 hover:border-accent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Attendance
              </p>
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-600">
                {todayIns.length > 0
                  ? `${Math.round(((todayIns.length - lateToday) / todayIns.length) * 100)}%`
                  : "—"}
              </span>
            </div>
            <p className="font-display text-2xl font-extrabold">{todayIns.length}</p>
          </Card>
          <Card className="p-4 hover:border-accent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Announcements
              </p>
              <Megaphone className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-display text-2xl font-extrabold">{announcementCount ?? "—"}</p>
          </Card>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide">Recent Activity</h2>
            <Link
              to="/dashboard/admin/students"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Card className="divide-y divide-border/50">
            {todayLogs.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No activity today.</p>
            )}
            {todayLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`h-2 w-2 rounded-full flex-shrink-0 ${log.status === "late" ? "bg-yellow-500" : "bg-green-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{nameOf.get(log.student_id) ?? "Unknown"}</span>{" "}
                    scanned {log.scan_type === "in" ? "in" : "out"}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtTime(log.timestamp)}</p>
                </div>
                <Badge tone={log.status === "late" ? "amber" : "green"}>{log.status}</Badge>
              </div>
            ))}
          </Card>
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              to="/dashboard/admin/students"
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-accent"
            >
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">Students</p>
                <p className="text-xs text-muted-foreground">Manage roster & RFID</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/dashboard/admin/courses"
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-accent"
            >
              <BookOpen className="h-5 w-5 text-sky-500" />
              <div>
                <p className="text-sm font-semibold">Courses</p>
                <p className="text-xs text-muted-foreground">Create & manage courses</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/dashboard/admin/announcements"
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-accent"
            >
              <Megaphone className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-semibold">Announcements</p>
                <p className="text-xs text-muted-foreground">Post updates & alerts</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/dashboard/admin/attendance"
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-accent"
            >
              <CalendarCheck className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-semibold">Attendance</p>
                <p className="text-xs text-muted-foreground">View logs & reports</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CalendarCheck, ClipboardList, Megaphone, TrendingUp } from "lucide-react";
import {
  attendancePercent,
  attendanceStreak,
  daysUntil,
  fmtDate,
  listAnnouncements,
  listAssignments,
  listAttendance,
  listCourses,
  listGradesForStudent,
  listSubmissionsForStudent,
  transmutedOf,
} from "@/lib/lms";
import {
  AppShell,
  Badge,
  Card,
  EmptyState,
  FadeIn,
  MotionCard,
  ProgressBar,
  STUDENT_NAV,
  courseStyle,
  useProfile,
} from "@/components/lms";

export const Route = createFileRoute("/dashboard/student/")({
  head: () => ({
    meta: [
      { title: "Student Dashboard | MIOW - MSU-IIT IDS Online Workspace" },
      { name: "description", content: "Your classes, grades, tasks and attendance at a glance." },
      { property: "og:title", content: "Student Dashboard | MIOW - MSU-IIT IDS Online Workspace" },
      { property: "og:description", content: "Your classes, grades, tasks and attendance at a glance." },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const profile = useProfile(["student"]);
  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: listCourses, enabled: !!profile });
  const { data: grades } = useQuery({
    queryKey: ["grades", profile?.id],
    queryFn: () => listGradesForStudent(profile!.id),
    enabled: !!profile,
  });
  const { data: assignments } = useQuery({ queryKey: ["assignments"], queryFn: listAssignments, enabled: !!profile });
  const { data: submissions } = useQuery({
    queryKey: ["submissions", profile?.id],
    queryFn: () => listSubmissionsForStudent(profile!.id),
    enabled: !!profile,
  });
  const { data: announcements } = useQuery({ queryKey: ["announcements"], queryFn: listAnnouncements, enabled: !!profile });
  const { data: logs } = useQuery({
    queryKey: ["attendance", profile?.id],
    queryFn: () => listAttendance(profile!.id),
    enabled: !!profile,
  });

  if (!profile) return null;

  const myCourses = (courses ?? []).filter((c) => c.grade_level === profile.grade_level);
  const courseIds = new Set(myCourses.map((c) => c.id));
  const submittedIds = new Set(
    (submissions ?? []).filter((s) => s.status !== "pending").map((s) => s.assignment_id),
  );
  const pending = (assignments ?? []).filter((a) => courseIds.has(a.course_id) && !submittedIds.has(a.id));
  const att = attendancePercent(logs ?? []);
  const graded = (grades ?? []).map((g) => ({ g, t: transmutedOf(g, att) })).filter((x) => x.t != null);
  const gwa = graded.length
    ? Math.round((graded.reduce((s, x) => s + (x.t ?? 0), 0) / graded.length) * 10) / 10
    : null;
  const streak = attendanceStreak(logs ?? []);
  const visible = (announcements ?? []).filter(
    (a) => a.target_audience === "all" || a.target_audience === "students",
  );
  const urgent = visible.filter((a) => a.category === "urgent");

  const stats = [
    { label: "General Average", value: gwa ?? "—", sub: "Transmuted, all subjects", icon: <TrendingUp className="h-4 w-4 text-primary" /> },
    { label: "Attendance Streak", value: `${streak} days`, sub: "Consecutive school days present", icon: <CalendarCheck className="h-4 w-4 text-emerald-500" /> },
    { label: "Pending Tasks", value: pending.length, sub: "Assignments awaiting submission", icon: <ClipboardList className="h-4 w-4 text-amber-500" /> },
    { label: "Subjects", value: myCourses.length, sub: "Enrolled this semester", icon: <Megaphone className="h-4 w-4 text-sky-500" /> },
  ];

  return (
    <AppShell nav={STUDENT_NAV} profile={profile} subtitle="Student Portal">
      <FadeIn>
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            Student Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kumusta, {profile.full_name.split(" ")[0]}! · Grade {profile.grade_level} · {profile.section} · {profile.student_id}
          </p>
        </div>
      </FadeIn>

      {urgent.length > 0 && (
        <FadeIn delay={0.05}>
          <div className="mb-6 space-y-2">
            {urgent.slice(0, 2).map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-2xl border border-rose-300/60 bg-rose-50/80 p-4 backdrop-blur-md dark:border-rose-500/30 dark:bg-rose-500/10"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="text-sm font-bold text-rose-800 dark:text-rose-200">{a.title}</p>
                  <p className="mt-0.5 text-sm text-rose-700/90 dark:text-rose-300/80">{a.content}</p>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <MotionCard key={s.label} delay={0.05 * i} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
              {s.icon}
            </div>
            <p className="mt-2 font-display text-3xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </MotionCard>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FadeIn delay={0.15}>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">My Subjects</h2>
                <Link to="/dashboard/student/grades" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  View grades <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {myCourses.length === 0 ? (
                <EmptyState title="No subjects yet" sub="Your enrollments will appear here." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {myCourses.map((c) => {
                    const st = courseStyle(c.color);
                    const grade = (grades ?? []).find((g) => g.course_id === c.id);
                    const t = grade ? transmutedOf(grade, att) : null;
                    return (
                      <Card key={c.id} className="p-4 transition-transform duration-150 hover:-translate-y-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-muted-foreground">{c.code}</p>
                            <p className="font-semibold leading-snug">{c.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{c.teacher_name ?? "TBA"}</p>
                          </div>
                          <span className={`rounded-lg px-2 py-1 text-xs font-bold ${st.soft}`}>
                            {t != null ? t : "—"}
                          </span>
                        </div>
                        <div className="mt-3">
                          <ProgressBar value={t != null ? t : 0} barClass={st.bar} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </FadeIn>

          <FadeIn delay={0.2}>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Upcoming Tasks</h2>
                <Link to="/dashboard/student/assignments" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  All assignments <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {pending.length === 0 ? (
                <EmptyState title="All caught up!" sub="No pending assignments right now." />
              ) : (
                <Card className="divide-y divide-border">
                  {pending.slice(0, 5).map((a) => {
                    const c = myCourses.find((x) => x.id === a.course_id);
                    const due = daysUntil(a.due_date);
                    return (
                      <div key={a.id} className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {c?.code} · {fmtDate(a.due_date)}
                          </p>
                        </div>
                        <Badge tone={due === "Overdue" ? "red" : due.includes("today") || due.includes("tomorrow") ? "amber" : "slate"}>
                          {due}
                        </Badge>
                      </div>
                    );
                  })}
                </Card>
              )}
            </section>
          </FadeIn>
        </div>

        <FadeIn delay={0.25}>
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Announcements</h2>
            <div className="space-y-3">
              {visible.slice(0, 4).map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone={a.category === "urgent" ? "red" : a.category === "event" ? "green" : "indigo"}>
                      {a.category}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-snug">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
                </Card>
              ))}
              {visible.length === 0 && <EmptyState title="No announcements" />}
            </div>
          </section>
        </FadeIn>
      </div>
    </AppShell>
  );
}

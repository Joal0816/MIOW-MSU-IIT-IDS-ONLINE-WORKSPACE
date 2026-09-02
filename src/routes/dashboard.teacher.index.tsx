import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Megaphone, Users, CalendarCheck, Layers } from "lucide-react";
import { countRows, listCourses, listStudents } from "@/lib/lms";
import { AppShell, Card, TEACHER_NAV, useProfile } from "@/components/lms";

export const Route = createFileRoute("/dashboard/teacher/")({
  head: () => ({
    meta: [
      { title: "Teacher Dashboard | MIOW - MSU-IIT IDS Online Workspace" },
      { name: "description", content: "Teacher overview — your courses, students and announcements." },
    ],
  }),
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const profile = useProfile(["teacher", "admin"]);
  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: listCourses, enabled: !!profile });
  const { data: students } = useQuery({ queryKey: ["students"], queryFn: listStudents, enabled: !!profile });
  const { data: announcementCount } = useQuery({ queryKey: ["count", "announcements"], queryFn: () => countRows("announcements"), enabled: !!profile });

  if (!profile) return null;
  const myCourses = (courses ?? []).filter((c) => c.teacher_id === profile.id);

  return (
    <AppShell nav={TEACHER_NAV} profile={profile} subtitle="Teacher Portal">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Teacher Dashboard</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Welcome back, {profile.full_name}.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Courses</p>
            <BookOpen className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{myCourses.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{courses?.length ?? 0} total in campus</p>
          <Link to="/dashboard/admin/courses" className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Manage courses <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Students</p>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{students?.length ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Enrolled learners</p>
          <Link to="/dashboard/teacher/students" className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            View Students Info <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Announcements</p>
            <Megaphone className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{announcementCount ?? "—"}</p>
          <Link to="/dashboard/admin/announcements" className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Post announcement <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-500" />
            <p className="text-sm font-semibold">Gradebook</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Encode grades and track submissions for your courses.</p>
          <Link to="/dashboard/admin/grades" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Open Gradebook <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-semibold">Attendance Kiosk</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">View taps and manage the gate attendance log.</p>
          <Link to="/dashboard/admin/attendance" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Open Attendance <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}

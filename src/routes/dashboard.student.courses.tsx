import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, ClipboardList, FileQuestion } from "lucide-react";
import {
  COMPONENT_LABELS,
  daysUntil,
  fmtDate,
  listAssignments,
  listCourses,
  listQuizzes,
  listSubmissionsForStudent,
  myQuizSummaries,
  formatSchedule,
  type Assignment,
  type Quiz,
} from "@/lib/lms";
import {
  AppShell,
  Badge,
  EmptyState,
  MotionCard,
  STUDENT_NAV,
  courseStyle,
  useProfile,
} from "@/components/lms";
import { levelLabel } from "@/lib/course-levels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/student/courses")({
  head: () => ({
    meta: [
      { title: "Courses | MIOW - MSU-IIT IDS Online Workspace" },
      { name: "description", content: "View your enrolled courses, assignments and worksheets." },
      { property: "og:title", content: "Courses | MIOW - MSU-IIT IDS Online Workspace" },
      {
        property: "og:description",
        content: "View your enrolled courses, assignments and worksheets.",
      },
    ],
  }),
  component: StudentCoursesPage,
});

type Tab = "courses" | "worksheets" | "assignments";

function StudentCoursesPage() {
  const profile = useProfile(["student"]);
  const [tab, setTab] = useState<Tab>("courses");

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
    enabled: !!profile,
  });
  const { data: assignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: listAssignments,
    enabled: !!profile,
  });
  const { data: quizzes } = useQuery({
    queryKey: ["quizzes"],
    queryFn: listQuizzes,
    enabled: !!profile,
  });
  const { data: submissions } = useQuery({
    queryKey: ["submissions", profile?.id],
    queryFn: () => listSubmissionsForStudent(profile!.id),
    enabled: !!profile,
  });
  const { data: quizSummaries } = useQuery({
    queryKey: ["quiz-summaries"],
    queryFn: myQuizSummaries,
    enabled: !!profile,
  });

  if (!profile) return null;

  const myCourses = (courses ?? []).filter((c) => c.grade_level === profile.grade_level);
  const courseIds = new Set(myCourses.map((c) => c.id));
  const myAssignments = (assignments ?? []).filter((a) => courseIds.has(a.course_id));
  const myQuizzes = (quizzes ?? []).filter((q) => courseIds.has(q.course_id));
  const subByAssignment = new Map((submissions ?? []).map((s) => [s.assignment_id, s]));
  const summaryByQuiz = new Map((quizSummaries ?? []).map((s) => [s.quiz_id, s]));

  const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; count: number }> = [
    {
      id: "courses",
      label: "Courses",
      icon: <BookOpen className="h-4 w-4" />,
      count: myCourses.length,
    },
    {
      id: "worksheets",
      label: "Worksheets",
      icon: <FileQuestion className="h-4 w-4" />,
      count: myQuizzes.length,
    },
    {
      id: "assignments",
      label: "Assignments",
      icon: <ClipboardList className="h-4 w-4" />,
      count: myAssignments.length,
    },
  ];

  return (
    <AppShell nav={STUDENT_NAV} profile={profile} subtitle="Student Portal">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {myCourses.length} enrolled course{myCourses.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {t.icon}
            {t.label}
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                tab === t.id ? "bg-white/20" : "bg-muted-foreground/10",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Courses tab ─────────────────────────────────────────────── */}
      {tab === "courses" && (
        <>
          {myCourses.length === 0 ? (
            <EmptyState title="No courses yet" sub="Your enrolled courses will appear here." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myCourses.map((c, i) => {
                const st = courseStyle(c.color);
                return (
                  <MotionCard
                    key={c.id}
                    delay={Math.min(i * 0.05, 0.3)}
                    className="overflow-hidden"
                  >
                    <div className={cn("h-2", st.chip)} />
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-muted-foreground">{c.code}</p>
                        <Badge tone="slate">{levelLabel(c.grade_level)}</Badge>
                      </div>
                      <p className="mt-1.5 font-semibold leading-snug">{c.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.teacher_name ?? "TBA"}
                      </p>
                      {formatSchedule(c) && (
                        <p className="mt-1 text-xs font-medium text-primary">{formatSchedule(c)}</p>
                      )}
                      <p className="mt-3 text-xs font-semibold text-muted-foreground">
                        {myAssignments.filter((a) => a.course_id === c.id).length} assignment
                        {myAssignments.filter((a) => a.course_id === c.id).length !== 1
                          ? "s"
                          : ""}{" "}
                        · {myQuizzes.filter((q) => q.course_id === c.id).length} worksheet
                        {myQuizzes.filter((q) => q.course_id === c.id).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </MotionCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Worksheets tab ──────────────────────────────────────────── */}
      {tab === "worksheets" && (
        <>
          {myQuizzes.length === 0 ? (
            <EmptyState
              title="No worksheets yet"
              sub="Worksheets posted by your teacher will appear here."
            />
          ) : (
            <div className="grid gap-2">
              {myQuizzes.map((q) => {
                const course = myCourses.find((c) => c.id === q.course_id);
                const st = courseStyle(course?.color ?? "indigo");
                const summary = summaryByQuiz.get(q.id);
                return (
                  <MotionCard key={q.id} className="flex flex-wrap items-center gap-3 p-4">
                    <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", st.soft)}>
                      {course?.code ?? "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.duration_minutes} min
                        {q.allow_retake
                          ? q.max_attempts === 0
                            ? " · Retakes allowed (unlimited)"
                            : ` · Retakes allowed (up to ${q.max_attempts})`
                          : " · Single attempt"}
                      </p>
                    </div>
                    {summary ? (
                      <Badge tone="green">
                        Score: {summary.effective_score}/{summary.effective_total}
                      </Badge>
                    ) : (
                      <Badge tone="slate">Not started</Badge>
                    )}
                    <Link
                      to="/dashboard/student/quizzes"
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15"
                    >
                      {summary ? "Retake" : "Start"} →
                    </Link>
                  </MotionCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Assignments tab ─────────────────────────────────────────── */}
      {tab === "assignments" && (
        <>
          {myAssignments.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              sub="Activities posted by your teacher will appear here."
            />
          ) : (
            <div className="grid gap-2">
              {myAssignments.map((a) => {
                const course = myCourses.find((c) => c.id === a.course_id);
                const st = courseStyle(course?.color ?? "indigo");
                const sub = subByAssignment.get(a.id);
                const due = daysUntil(a.due_date);
                const status = !sub || sub.status === "pending" ? "pending" : sub.status;
                return (
                  <MotionCard key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                    <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", st.soft)}>
                      {course?.code ?? "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {COMPONENT_LABELS[a.component_type]} · {a.total_points} pts
                        {a.due_date ? ` · due ${fmtDate(a.due_date)}` : ""}
                      </p>
                    </div>
                    {status === "graded" && sub?.score != null ? (
                      <Badge tone="green">
                        {sub.score}/{a.total_points}
                      </Badge>
                    ) : status === "submitted" ? (
                      <Badge tone="amber">Submitted</Badge>
                    ) : (
                      <Badge
                        tone={
                          due === "Overdue"
                            ? "red"
                            : due.includes("today") || due.includes("tomorrow")
                              ? "amber"
                              : "slate"
                        }
                      >
                        {due}
                      </Badge>
                    )}
                    <Link
                      to="/dashboard/student/assignments"
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15"
                    >
                      {status === "pending" ? "Submit" : "View"} →
                    </Link>
                  </MotionCard>
                );
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

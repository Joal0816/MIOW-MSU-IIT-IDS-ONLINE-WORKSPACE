import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import {
  WEIGHTS,
  attendancePercent,
  gradeRemarks,
  initialOf,
  listAttendance,
  listCourses,
  listGradesForStudent,
  transmute,
  transmutedOf,
  type Course,
  type Grade,
} from "@/lib/lms";
import { AppShell, Badge, Card, EmptyState, Modal, ProgressBar, STUDENT_NAV, courseStyle, useProfile } from "@/components/lms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/student/grades")({
  head: () => ({
    meta: [
      { title: "My Grades | MIOW - MSU-IIT IDS Online Workspace" },
      { name: "description", content: "Quarterly grades with DepEd transmutation and remarks." },
      { property: "og:title", content: "My Grades | MIOW - MSU-IIT IDS Online Workspace" },
      { property: "og:description", content: "Quarterly grades with DepEd transmutation and remarks." },
    ],
  }),
  component: GradesPage,
});

function GradesPage() {
  const profile = useProfile(["student"]);
  const [quarter, setQuarter] = useState(1);
  const [showTable, setShowTable] = useState(false);
  const [detail, setDetail] = useState<{ course: Course; grade: Grade | undefined } | null>(null);
  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: listCourses, enabled: !!profile });
  const { data: grades } = useQuery({
    queryKey: ["grades", profile?.id],
    queryFn: () => listGradesForStudent(profile!.id),
    enabled: !!profile,
  });
  const { data: logs } = useQuery({
    queryKey: ["attendance", profile?.id],
    queryFn: () => listAttendance(profile!.id),
    enabled: !!profile,
  });

  if (!profile) return null;

  // Attendance component (10%) comes from the student's gate logs.
  const att = attendancePercent(logs ?? []);
  const myCourses = (courses ?? []).filter((c) => c.grade_level === profile.grade_level);
  const rows = myCourses.map((c) => {
    const g = (grades ?? []).find((x) => x.course_id === c.id && x.quarter === quarter);
    return { course: c, grade: g };
  });
  const withGrades = rows.filter((r) => r.grade && transmutedOf(r.grade, att) != null);
  const gwa = withGrades.length
    ? Math.round((withGrades.reduce((s, r) => s + (transmutedOf(r.grade!, att) ?? 0), 0) / withGrades.length) * 10) / 10
    : null;

  return (
    <AppShell nav={STUDENT_NAV} profile={profile} subtitle="Student Portal">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Report Card</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weighted 10% Attendance · 20% Written Work · 30% Periodical Exam · 40% Performance Tasks, then transmuted per DepEd DO 8, s. 2015. Tap a subject for the full breakdown.
          </p>
        </div>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur-md hover:bg-muted"
        >
          <Info className="h-3.5 w-3.5" /> Transmutation table
        </button>
      </div>

      <div className="mb-5 flex gap-1 rounded-xl bg-muted/80 p-1 backdrop-blur-sm">
        {[1, 2, 3, 4].map((q) => (
          <button
            key={q}
            onClick={() => setQuarter(q)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              quarter === q ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Q{q}
          </button>
        ))}
      </div>

      {showTable && (
        <Card className="mb-5 max-h-56 overflow-y-auto p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            DepEd Transmutation (Initial → Transmuted)
          </p>
          <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs sm:grid-cols-6">
            {[100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 40, 30, 20, 10, 0].map((i) => (
              <div key={i} className="flex justify-between rounded bg-muted px-2 py-1">
                <span>{i}</span>
                <span className="font-bold">{transmute(i)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-5 flex items-center justify-between p-5">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            General Weighted Average — Quarter {quarter}
          </h2>
          <p className="mt-1 font-display text-3xl font-bold">{gwa ?? "—"}</p>
        </div>
        {gwa != null && (
          <Badge tone={gwa >= 90 ? "green" : gwa >= 75 ? "indigo" : "red"}>{gradeRemarks(gwa)}</Badge>
        )}
      </Card>

      {rows.every((r) => !r.grade) ? (
        <EmptyState title={`No grades encoded for Quarter ${quarter} yet`} sub="Check back after your teachers finalize the gradebook." />
      ) : (
        <Card className="overflow-x-auto">
          <h2 className="px-4 pt-4 font-display text-base font-bold">
            Quarter {quarter} Grades by Subject
          </h2>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-4">Subject</th>
                <th className="p-4 text-center">Att (10%)</th>
                <th className="p-4 text-center">WW (20%)</th>
                <th className="p-4 text-center">PT (40%)</th>
                <th className="p-4 text-center">Exam (30%)</th>
                <th className="p-4 text-center">Initial</th>
                <th className="p-4 text-center">Transmuted</th>
                <th className="p-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ course, grade }) => {
                const st = courseStyle(course.color);
                const initial = grade ? initialOf(grade, att) : null;
                const t = grade ? transmutedOf(grade, att) : null;
                return (
                  <tr
                    key={course.id}
                    onClick={() => setDetail({ course, grade })}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-1.5 rounded-full ${st.chip}`} />
                        <div>
                          <p className="font-semibold">{course.title}</p>
                          <p className="text-xs text-muted-foreground">{course.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">{att ?? "—"}</td>
                    <td className="p-4 text-center">{grade?.written_work_score ?? "—"}</td>
                    <td className="p-4 text-center">{grade?.performance_task_score ?? "—"}</td>
                    <td className="p-4 text-center">{grade?.exam_score ?? "—"}</td>
                    <td className="p-4 text-center">{initial != null ? initial.toFixed(1) : "—"}</td>
                    <td className="p-4 text-center">
                      <span className={cn("font-display text-base font-bold", t != null && t < 75 && "text-rose-600")}>
                        {t ?? "—"}
                      </span>
                    </td>
                    <td className="p-4">
                      {t != null ? (
                        <Badge tone={t >= 90 ? "green" : t >= 80 ? "indigo" : t >= 75 ? "amber" : "red"}>
                          {gradeRemarks(t)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.course.code} — ${detail.course.title}` : ""}
      >
        {detail && <GradeBreakdown grade={detail.grade} att={att} />}
      </Modal>
    </AppShell>
  );
}

function GradeBreakdown({ grade, att }: { grade: Grade | undefined; att: number | null }) {
  if (!grade) return <p className="text-sm text-muted-foreground">No scores encoded for this quarter yet.</p>;
  const components = [
    { label: "Attendance", weight: WEIGHTS.attendance, score: att },
    { label: "Written Work", weight: WEIGHTS.written_work, score: grade.written_work_score },
    { label: "Periodical Exam", weight: WEIGHTS.quarterly_exam, score: grade.exam_score },
    { label: "Performance Tasks", weight: WEIGHTS.performance_task, score: grade.performance_task_score },
  ];
  const initial = initialOf(grade, att);
  const t = transmutedOf(grade, att);
  const passed = t != null && t >= 75;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {components.map((c) => {
          const contribution = c.score != null ? c.score * c.weight : null;
          return (
            <div key={c.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground">
                  {c.score ?? "—"} × {Math.round(c.weight * 100)}% ={" "}
                  <span className="font-semibold text-foreground">
                    {contribution != null ? contribution.toFixed(1) : "—"}
                  </span>
                </span>
              </div>
              <ProgressBar value={c.score ?? 0} />
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Initial grade</p>
          <p className="mt-1 font-display text-2xl font-bold">{initial != null ? initial.toFixed(1) : "—"}</p>
        </div>
        <div className="rounded-xl bg-muted p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transmuted</p>
          <p className={cn("mt-1 font-display text-2xl font-bold", t != null && t < 75 && "text-rose-600")}>
            {t ?? "—"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        {t != null && (
          <>
            <Badge tone={passed ? "green" : "red"}>{passed ? "Passed" : "Failing"}</Badge>
            <Badge tone={t >= 90 ? "green" : t >= 80 ? "indigo" : t >= 75 ? "amber" : "red"}>
              {gradeRemarks(t)}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}

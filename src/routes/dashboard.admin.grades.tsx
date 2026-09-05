import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Send } from "lucide-react";
import { toast } from "sonner";
import { ATTENDANCE_LIMIT_GRADES } from "@/components/courses/constants";
import {
  attendancePercent,
  enrollmentsForCourse,
  gradeRemarks,
  listAllAttendance,
  listCourses,
  listGradesForCourse,
  listStudents,
  transmute,
  upsertGrade,
  weightedInitial,
  type AttendanceLog,
  listQuizScoresForCourse,
  type QuizCourseScore,
} from "@/lib/lms";
import {
  TEACHER_NAV,
  AppShell,
  Badge,
  Card,
  EmptyState,
  MotionCard,
  useProfile,
} from "@/components/lms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/admin/grades")({
  head: () => ({
    meta: [
      { title: "Gradebook | MIOW - Integrated Developmental School" },
      {
        name: "description",
        content: "Encode quarterly grades with automatic DepEd transmutation.",
      },
      { property: "og:title", content: "Gradebook | MIOW - Integrated Developmental School" },
      {
        property: "og:description",
        content: "Encode quarterly grades with automatic DepEd transmutation.",
      },
    ],
  }),
  component: GradebookPage,
});

interface CellState {
  ww: string;
  pt: string;
  ex: string;
}

function GradebookPage() {
  const profile = useProfile(["admin", "teacher"]);
  const qc = useQueryClient();
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
    enabled: !!profile,
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: listStudents,
    enabled: !!profile,
  });
  // Gate attendance feeds the Attendance (10%) component of the grading scheme.
  const { data: allLogs } = useQuery({
    queryKey: ["all-attendance"],
    queryFn: () => listAllAttendance(ATTENDANCE_LIMIT_GRADES),
    enabled: !!profile,
  });

  const [courseId, setCourseId] = useState("");
  const [quarter, setQuarter] = useState(1);
  const [section, setSection] = useState("all");
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(false);
  const [gradeTab, setGradeTab] = useState<"grades" | "quizzes">("grades");

  const course = useMemo(() => (courses ?? []).find((c) => c.id === courseId), [courses, courseId]);

  const attByStudent = useMemo(() => {
    const grouped = new Map<string, AttendanceLog[]>();
    (allLogs ?? []).forEach((l) => {
      const arr = grouped.get(l.student_id) ?? [];
      arr.push(l);
      grouped.set(l.student_id, arr);
    });
    const out = new Map<string, number | null>();
    grouped.forEach((logs, id) => out.set(id, attendancePercent(logs)));
    return out;
  }, [allLogs]);
  const attOf = (sid: string): number | null => attByStudent.get(sid) ?? null;

  const { data: enrolledIds } = useQuery({
    queryKey: ["enrollments", courseId],
    queryFn: () => enrollmentsForCourse(courseId),
    enabled: !!courseId,
  });
  const { data: existing } = useQuery({
    queryKey: ["course-grades", courseId, quarter],
    queryFn: () => listGradesForCourse(courseId, quarter),
    enabled: !!courseId,
  });
  const { data: quizScores, error: quizScoresError } = useQuery({
    queryKey: ["quiz-scores", courseId],
    queryFn: () => listQuizScoresForCourse(courseId),
    enabled: !!courseId,
  });

  useEffect(() => {
    if (!courses?.length && courseId) return;
    if (!courseId && courses?.length) setCourseId(courses[0]!.id);
  }, [courses, courseId]);

  useEffect(() => {
    const next: Record<string, CellState> = {};
    (existing ?? []).forEach((g) => {
      next[g.student_id] = {
        ww: g.written_work_score?.toString() ?? "",
        pt: g.performance_task_score?.toString() ?? "",
        ex: g.exam_score?.toString() ?? "",
      };
    });
    setCells(next);
    setPublished((existing ?? []).length > 0);
  }, [existing]);

  useEffect(() => {
    setSection("all");
  }, [courseId]);

  if (!profile) return null;

  const roster = (students ?? []).filter((s) =>
    enrolledIds && enrolledIds.length > 0
      ? enrolledIds.includes(s.id)
      : s.grade_level === course?.grade_level,
  );
  const sections = [
    ...new Set(roster.map((s) => s.section).filter((x): x is string => !!x)),
  ].sort();
  const visibleRoster = section === "all" ? roster : roster.filter((s) => s.section === section);

  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.min(100, Number(v))));

  const preview = (sid: string) => {
    const c = cells[sid];
    if (!c) return null;
    const initial = weightedInitial(num(c.ww), num(c.pt), num(c.ex), attOf(sid));
    if (initial == null) return null;
    return { initial, t: transmute(initial) };
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      let n = 0;
      for (const s of roster) {
        const c = cells[s.id];
        if (!c || (c.ww === "" && c.pt === "" && c.ex === "")) continue;
        const initial = weightedInitial(num(c.ww), num(c.pt), num(c.ex), attOf(s.id));
        await upsertGrade({
          student_id: s.id,
          course_id: courseId,
          quarter,
          written_work_score: num(c.ww),
          performance_task_score: num(c.pt),
          exam_score: num(c.ex),
          transmuted_final_grade: initial != null ? transmute(initial) : null,
        });
        n++;
      }
      toast.success(`Saved and published grades for ${n} student${n === 1 ? "" : "s"}.`);
      setPublished(true);
      qc.invalidateQueries({ queryKey: ["course-grades", courseId, quarter] });
      qc.invalidateQueries({ queryKey: ["grades"] });
    } catch {
      toast.error("Could not save grades.");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const header = [
      "Student No",
      "Name",
      "Section",
      "Attendance (10%)",
      "WW (20%)",
      "PT (40%)",
      "Exam (30%)",
      "Initial",
      "Transmuted",
      "Remarks",
    ];
    const rows = visibleRoster.map((s) => {
      const c = cells[s.id] ?? { ww: "", pt: "", ex: "" };
      const p = preview(s.id);
      return [
        s.student_id ?? "",
        s.full_name,
        s.section ?? "",
        attOf(s.id) ?? "",
        c.ww,
        c.pt,
        c.ex,
        p ? p.initial.toFixed(1) : "",
        p ? String(p.t) : "",
        p ? gradeRemarks(p.t) : "",
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course?.code ?? "grades"}-Q${quarter}${section === "all" ? "" : `-${section}`}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  };

  return (
    <AppShell nav={TEACHER_NAV} profile={profile} subtitle="Teacher Portal">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Gradebook</h1>
        {published && <Badge tone="green">Published</Badge>}
      </div>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Enter component scores (0–100). The final grade is weighted Attendance 10% · WW 20% ·
        Periodical Exam 30% · PT 40% and transmuted automatically. Attendance is pulled from gate
        logs.
      </p>

      <div className="mb-5 flex flex-wrap gap-3">
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="h-11 min-w-56 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {(courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title} (G{c.grade_level})
            </option>
          ))}
        </select>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {[1, 2, 3, 4].map((q) => (
            <button
              key={q}
              onClick={() => setQuarter(q)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold",
                quarter === q ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              Q{q}
            </button>
          ))}
        </div>
        {sections.length > 1 && (
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={exportCsv}
            disabled={!courseId || visibleRoster.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={saveAll}
            disabled={saving || !courseId}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {saving ? "Publishing…" : "Save & publish"}
          </button>
        </div>
      </div>

      {/* ── Tab Switcher ─────────────────────────────────────────── */}
      {courseId && (
        <div className="flex gap-1 rounded-xl bg-muted p-1 mb-5 w-fit">
          <button
            onClick={() => setGradeTab("grades")}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-semibold transition",
              gradeTab === "grades"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Grades (WW / PT / Exam)
          </button>
          <button
            onClick={() => setGradeTab("quizzes")}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-semibold transition",
              gradeTab === "quizzes"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Quiz Scores {quizScores && quizScores.length > 0 ? `(${quizScores.length})` : ""}
          </button>
        </div>
      )}

      {/* ── Grades Tab ───────────────────────────────────────────── */}
      {gradeTab === "grades" && (
        <>
          {!courseId || visibleRoster.length === 0 ? (
            <EmptyState
              title="No students on this roster"
              sub="Enroll students or pick another course or section."
            />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-4">Student</th>
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
                  {visibleRoster.map((s) => {
                    const c = cells[s.id] ?? { ww: "", pt: "", ex: "" };
                    const p = preview(s.id);
                    const setCell =
                      (k: keyof CellState) => (e: React.ChangeEvent<HTMLInputElement>) =>
                        setCells((all) => ({
                          ...all,
                          [s.id]: { ...c, [k]: e.target.value.replace(/[^0-9.]/g, "") },
                        }));
                    return (
                      <tr key={s.id}>
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            <img src={s.avatar_url ?? ""} alt="" className="h-8 w-8 rounded-full" />
                            <div>
                              <p className="font-semibold">{s.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.student_id} · {s.section}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center text-muted-foreground">
                          {attOf(s.id) ?? "—"}
                        </td>
                        {(["ww", "pt", "ex"] as const).map((k) => (
                          <td key={k} className="p-4 text-center">
                            <input
                              value={c[k]}
                              onChange={setCell(k)}
                              inputMode="decimal"
                              placeholder="—"
                              className="h-9 w-20 rounded-lg border border-input bg-background text-center text-sm outline-none focus:ring-2 focus:ring-ring"
                            />
                          </td>
                        ))}
                        <td className="p-4 text-center">{p ? p.initial.toFixed(1) : "—"}</td>
                        <td className="p-4 text-center">
                          <span
                            className={cn(
                              "font-display text-base font-bold",
                              p && p.t < 75 && "text-rose-600 dark:text-rose-400",
                            )}
                          >
                            {p ? p.t : "—"}
                          </span>
                        </td>
                        <td className="p-4">
                          {p ? (
                            <Badge
                              tone={
                                p.t >= 90
                                  ? "green"
                                  : p.t >= 80
                                    ? "indigo"
                                    : p.t >= 75
                                      ? "amber"
                                      : "red"
                              }
                            >
                              {gradeRemarks(p.t)}
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
        </>
      )}

      {/* ── Quiz Scores Tab ──────────────────────────────────────── */}
      {gradeTab === "quizzes" && courseId && (
        <div>
          <p className="mb-4 text-xs text-muted-foreground">
            Best score per student per worksheet. Use these to inform the Written Work (WW)
            component in the Grades tab.
          </p>
          {!quizScores || quizScores.length === 0 ? (
            <EmptyState
              title="No worksheet scores yet"
              sub="Students need to submit worksheets for scores to appear here."
            />
          ) : visibleRoster.length === 0 ? (
            <EmptyState
              title="No students on this roster"
              sub="Enroll students or pick another course or section."
            />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-4 sticky left-0 bg-card z-10">Student</th>
                    {quizScores.map((q) => (
                      <th
                        key={q.quiz_id}
                        className="p-4 text-center max-w-[140px] truncate"
                        title={q.title}
                      >
                        {q.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleRoster.map((s) => (
                    <tr key={s.id}>
                      <td className="p-4 sticky left-0 bg-card z-10">
                        <p className="font-semibold">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.student_id}</p>
                      </td>
                      {quizScores.map((q) => {
                        const score = q.scores[s.id];
                        if (!score)
                          return (
                            <td key={q.quiz_id} className="p-4 text-center text-muted-foreground">
                              —
                            </td>
                          );
                        const pct =
                          score.total > 0 ? Math.round((score.score / score.total) * 100) : 0;
                        return (
                          <td key={q.quiz_id} className="p-4 text-center">
                            <span
                              className={cn(
                                "font-semibold",
                                pct >= 90
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : pct >= 75
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {score.score}/{score.total}
                            </span>
                            <span className="ml-1 text-xs text-muted-foreground">({pct}%)</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}

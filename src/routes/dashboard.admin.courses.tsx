import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, ClipboardList, CloudUpload, Eraser, FileQuestion, FileText, Paperclip, Pencil, Plus, RotateCcw, Settings2, Sparkles, Trash2, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  COMPONENT_LABELS,
  createAssignment,
  createCourse,
  attachCourseMaterial,
  createQuizWithQuestions,
  deleteAssignment,
  deleteCourse,
  deleteQuiz,
  formatFileSize,
  listAssignments,
  materialHref,
  removeCourseMaterial,
  updateAssignment,
  updateQuiz,
  uploadCourseMaterial,
  enrollmentsForCourse,
  formatSchedule,
  grantQuizRetake,
  listCourses,
  listQuizAttempts,
  listQuizzes,
  listTeachers,
  resetQuizAttempts,
  updateCourse,
  updateQuizRetakePolicy,
  type Assignment,
  type Attachment,
  type Course,
  type Quiz,
  type RetakePolicy,
} from "@/lib/lms";
import { staffNav, AppShell, Badge, EmptyState, Modal, MotionCard, courseStyle, useProfile } from "@/components/lms";
import { parseWorksheet } from "@/lib/worksheet-parser";
import { openWorksheetChat } from "@/lib/worksheet-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/admin/courses")({
  head: () => ({
    meta: [
      { title: "Courses | MIOW - MSU-IIT IDS Online Workspace" },
      { name: "description", content: "Manage courses, assignments and worksheets." },
      { property: "og:title", content: "Courses | MIOW - MSU-IIT IDS Online Workspace" },
      { property: "og:description", content: "Manage courses, assignments and worksheets." },
    ],
  }),
  component: CoursesPage,
});

const COLORS = ["indigo", "emerald", "sky", "amber", "rose", "violet"];

const DAYS: Array<{ code: string; label: string }> = [
  { code: "mon", label: "Mon" },
  { code: "tue", label: "Tue" },
  { code: "wed", label: "Wed" },
  { code: "thu", label: "Thu" },
  { code: "fri", label: "Fri" },
  { code: "sat", label: "Sat" },
  { code: "sun", label: "Sun" },
];

const EMPTY_COURSE = {
  title: "",
  code: "",
  grade_level: "10",
  teacher_id: "",
  color: "indigo",
  days: [] as string[],
  start_time: "",
  end_time: "",
  grace: "10",
};

const POLICY_LABELS: Record<RetakePolicy, string> = {
  highest_score: "Keep highest score",
  latest_attempt: "Keep latest attempt",
  average_score: "Average of all attempts",
};

/** Retake policy form state. `max_attempts` is a string for the input; 0 = unlimited. */
const EMPTY_POLICY = {
  allow_retake: false,
  unlimited: false,
  max_attempts: "1",
  retake_score_policy: "highest_score" as RetakePolicy,
};

/** Parse the policy form into the API payload (unlimited → max_attempts 0). */
function policyPayload(f: typeof EMPTY_POLICY) {
  return {
    allow_retake: f.allow_retake,
    max_attempts: f.allow_retake ? (f.unlimited ? 0 : Math.max(1, parseInt(f.max_attempts) || 1)) : 1,
    retake_score_policy: f.retake_score_policy,
  };
}

function CoursesPage() {
  const profile = useProfile(["admin", "teacher"]);
  const qc = useQueryClient();
  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: listCourses, enabled: !!profile });
  // Course-lead picker source: TEACHERS only — admin accounts never appear.
  const { data: teachers } = useQuery({ queryKey: ["teachers"], queryFn: listTeachers, enabled: !!profile });
  const { data: quizzes } = useQuery({ queryKey: ["quizzes"], queryFn: listQuizzes, enabled: !!profile });
  const { data: assignments } = useQuery({ queryKey: ["assignments"], queryFn: listAssignments, enabled: !!profile });

  const [modal, setModal] = useState<"course" | "assignment" | "quiz" | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE);
  const [assignForm, setAssignForm] = useState({ course_id: "", title: "", description: "", due_date: "", total_points: "100", component_type: "written_work" as const });
  const [quizForm, setQuizForm] = useState({ ...EMPTY_POLICY, course_id: "", title: "", duration_minutes: "15", questions: "" });
  // Files staged in the "Post assignment" form, uploaded once the row exists.
  const [assignFiles, setAssignFiles] = useState<File[]>([]);
  const [assignUploadPct, setAssignUploadPct] = useState(0);
  const [policyQuiz, setPolicyQuiz] = useState<Quiz | null>(null);
  const [policyForm, setPolicyForm] = useState(EMPTY_POLICY);
  const [rosterQuiz, setRosterQuiz] = useState<Quiz | null>(null);
  // Content editing / removal state (worksheets + assignments)
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null);
  const [editQuizForm, setEditQuizForm] = useState({ ...EMPTY_POLICY, title: "", duration_minutes: "15", questions: "" });
  const [editAssign, setEditAssign] = useState<Assignment | null>(null);
  const [editAssignForm, setEditAssignForm] = useState({ title: "", description: "", due_date: "", total_points: "100", component_type: "written_work" as Assignment["component_type"] });
  const [removeTarget, setRemoveTarget] = useState<{ kind: "quiz" | "assignment"; id: string; title: string } | null>(null);

  if (!profile) return null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["courses"] });

  const openEdit = (c: Course) => {
    setEditing(c);
    setCourseForm({
      title: c.title,
      code: c.code,
      grade_level: String(c.grade_level),
      teacher_id: c.teacher_id ?? "",
      color: c.color,
      days: c.days_of_week ?? [],
      start_time: c.start_time ? c.start_time.slice(0, 5) : "",
      end_time: c.end_time ? c.end_time.slice(0, 5) : "",
      grace: String(c.late_threshold_minutes ?? 10),
    });
    setModal("course");
  };

  const saveCourse = async () => {
    if (!courseForm.title || !courseForm.code) {
      toast.error("Title and code are required.");
      return;
    }
    if (courseForm.days.length > 0 && (!courseForm.start_time || !courseForm.end_time)) {
      toast.error("Set both a start and end time for the scheduled days (or clear the days).");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: courseForm.title,
        code: courseForm.code,
        grade_level: parseInt(courseForm.grade_level) || 10,
        teacher_id: courseForm.teacher_id || null,
        color: courseForm.color,
        days_of_week: courseForm.days.length ? courseForm.days : null,
        start_time: courseForm.days.length ? courseForm.start_time : null,
        end_time: courseForm.days.length ? courseForm.end_time : null,
        late_threshold_minutes: Math.min(60, Math.max(0, parseInt(courseForm.grace) || 10)),
      };
      if (editing) {
        await updateCourse(editing.id, payload);
        toast.success("Course updated.");
      } else {
        await createCourse(payload);
        toast.success("Course created.");
      }
      setModal(null);
      setEditing(null);
      setCourseForm(EMPTY_COURSE);
      refresh();
    } catch {
      toast.error(editing ? "Could not update course." : "Could not create course.");
    } finally {
      setSaving(false);
    }
  };

  const removeCourse = async (c: Course) => {
    if (!confirm(`Delete ${c.code} — ${c.title}? Its assignments and worksheets will also be removed.`)) return;
    try {
      await deleteCourse(c.id);
      toast.success("Course deleted.");
      refresh();
    } catch {
      toast.error("Delete failed.");
    }
  };

  const saveAssignment = async () => {
    if (!assignForm.course_id || !assignForm.title) {
      toast.error("Course and title are required.");
      return;
    }
    setSaving(true);
    setAssignUploadPct(0);
    try {
      // Upload staged reference materials first so the row is created with metadata.
      const attachments: Attachment[] = [];
      for (let i = 0; i < assignFiles.length; i++) {
        attachments.push(await uploadCourseMaterial(assignForm.course_id, assignFiles[i]!));
        setAssignUploadPct(Math.round(((i + 1) / assignFiles.length) * 100));
      }
      await createAssignment({
        course_id: assignForm.course_id,
        title: assignForm.title,
        description: assignForm.description || null,
        due_date: assignForm.due_date ? new Date(assignForm.due_date).toISOString() : null,
        total_points: parseInt(assignForm.total_points) || 100,
        component_type: assignForm.component_type,
        ...(attachments.length ? { attachments } : {}),
      });
      toast.success("Assignment posted.");
      qc.invalidateQueries({ queryKey: ["assignments"] });
      setModal(null);
      setAssignForm({ course_id: "", title: "", description: "", due_date: "", total_points: "100", component_type: "written_work" });
      setAssignFiles([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post assignment.");
    } finally {
      setSaving(false);
      setAssignUploadPct(0);
    }
  };

  const saveQuiz = async () => {
    if (!quizForm.course_id || !quizForm.title) {
      toast.error("Course and title are required.");
      return;
    }
    // Accepts the strict four-section format from ClassMate (Sections I–IV +
    // Answer Key) as well as legacy "Question | A, B, C, D | answer" lines.
    const { questions, dropped } = parseWorksheet(quizForm.questions);
    if (!questions.length) {
      toast.error(
        "No valid questions found — paste the four-section worksheet (with its Answer Key) or use 'Question | A, B, C, D | answer' lines.",
      );
      return;
    }
    if (dropped > 0) {
      toast.warning(`${dropped} item${dropped > 1 ? "s were" : " was"} skipped — check their numbering against the Answer Key.`);
    }
    setSaving(true);
    try {
      await createQuizWithQuestions(
        {
          course_id: quizForm.course_id,
          title: quizForm.title,
          duration_minutes: parseInt(quizForm.duration_minutes) || 15,
          ...policyPayload(quizForm),
        },
        questions,
      );
      toast.success(`Worksheet created with ${questions.length} questions.`);
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      setModal(null);
      setQuizForm({ ...EMPTY_POLICY, course_id: "", title: "", duration_minutes: "15", questions: "" });
    } catch {
      toast.error("Could not create worksheet.");
    } finally {
      setSaving(false);
    }
  };

  const openPolicy = (q: Quiz) => {
    setPolicyForm({
      allow_retake: q.allow_retake,
      unlimited: q.max_attempts === 0,
      max_attempts: String(q.max_attempts || 1),
      retake_score_policy: q.retake_score_policy,
    });
    setPolicyQuiz(q);
  };

  const savePolicy = async () => {
    if (!policyQuiz) return;
    setSaving(true);
    try {
      await updateQuizRetakePolicy(policyQuiz.id, policyPayload(policyForm));
      toast.success("Retake policy updated.");
      setPolicyQuiz(null);
      qc.invalidateQueries({ queryKey: ["quizzes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the retake policy.");
    } finally {
      setSaving(false);
    }
  };

  const openQuizEdit = (q: Quiz) => {
    setEditQuizForm({
      allow_retake: q.allow_retake,
      unlimited: q.max_attempts === 0,
      max_attempts: String(q.max_attempts || 1),
      retake_score_policy: q.retake_score_policy,
      title: q.title,
      duration_minutes: String(q.duration_minutes),
      questions: "",
    });
    setEditQuiz(q);
  };

  const saveQuizEdit = async () => {
    if (!editQuiz) return;
    if (!editQuizForm.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    // Pasting new content replaces the item set + answer key; leaving it empty
    // keeps the existing questions untouched.
    let questions: Array<{ question: string; options: string[]; correct_answer: string }> | undefined;
    if (editQuizForm.questions.trim()) {
      const parsed = parseWorksheet(editQuizForm.questions);
      if (!parsed.questions.length) {
        toast.error("No valid questions found in the replacement content.");
        return;
      }
      if (parsed.dropped > 0) toast.warning(`${parsed.dropped} item(s) skipped — check the Answer Key numbering.`);
      questions = parsed.questions;
    }
    setSaving(true);
    try {
      await updateQuiz(
        editQuiz.id,
        {
          title: editQuizForm.title.trim(),
          duration_minutes: Math.max(1, parseInt(editQuizForm.duration_minutes) || 15),
          ...policyPayload(editQuizForm),
        },
        questions,
      );
      toast.success(questions ? "Worksheet and questions updated." : "Worksheet updated.");
      setEditQuiz(null);
      qc.invalidateQueries({ queryKey: ["quizzes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the worksheet.");
    } finally {
      setSaving(false);
    }
  };

  const openAssignEdit = (a: Assignment) => {
    setEditAssignForm({
      title: a.title,
      description: a.description ?? "",
      due_date: a.due_date ? a.due_date.slice(0, 16) : "",
      total_points: String(a.total_points),
      component_type: a.component_type,
    });
    setEditAssign(a);
  };

  const saveAssignEdit = async () => {
    if (!editAssign) return;
    if (!editAssignForm.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setSaving(true);
    try {
      await updateAssignment(editAssign.id, {
        title: editAssignForm.title.trim(),
        description: editAssignForm.description || null,
        due_date: editAssignForm.due_date ? new Date(editAssignForm.due_date).toISOString() : null,
        total_points: Math.max(1, parseInt(editAssignForm.total_points) || 100),
        component_type: editAssignForm.component_type,
      });
      toast.success("Assignment updated.");
      setEditAssign(null);
      qc.invalidateQueries({ queryKey: ["assignments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the assignment.");
    } finally {
      setSaving(false);
    }
  };

  /** Soft delete keeps student grades & history; hard delete purges files too. */
  const confirmRemove = async (mode: "soft" | "hard") => {
    if (!removeTarget) return;
    setSaving(true);
    try {
      if (removeTarget.kind === "quiz") await deleteQuiz(removeTarget.id, mode);
      else await deleteAssignment(removeTarget.id, mode);
      toast.success(mode === "soft" ? "Archived — student records kept." : "Permanently deleted.");
      setRemoveTarget(null);
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove this item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell nav={staffNav(profile.role)} profile={profile} subtitle={profile.role === "admin" ? "MIOW Admin Console" : "MIOW Teacher Portal"}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">{courses?.length ?? 0} active courses</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setEditing(null);
              setCourseForm(EMPTY_COURSE);
              setModal("course");
            }}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <BookOpen className="h-4 w-4" /> Course
          </button>
          <button onClick={() => setModal("assignment")} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted">
            <ClipboardList className="h-4 w-4" /> Assignment
          </button>
          <button onClick={() => setModal("quiz")} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted">
            <FileQuestion className="h-4 w-4" /> Worksheet
          </button>
        </div>
      </div>

      {(courses ?? []).length === 0 ? (
        <EmptyState title="No courses yet" sub="Create your first course to begin." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(courses ?? []).map((c, i) => {
            const st = courseStyle(c.color);
            return (
              <MotionCard key={c.id} delay={Math.min(i * 0.05, 0.3)} className="overflow-hidden">
                <div className={cn("h-2", st.chip)} />
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-muted-foreground">{c.code}</p>
                    <div className="flex items-center gap-1">
                      <Badge tone="slate">Grade {c.grade_level}</Badge>
                      <button
                        onClick={() => openEdit(c)}
                        title="Edit course"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeCourse(c)}
                        title="Delete course"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 font-semibold leading-snug">{c.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.teacher_name ?? "No teacher assigned"}</p>
                  {formatSchedule(c) && (
                    <p className="mt-1 text-xs font-medium text-primary">{formatSchedule(c)}</p>
                  )}
                  <EnrollmentCount courseId={c.id} />
                </div>
              </MotionCard>
            );
          })}
        </div>
      )}

      {(quizzes ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold">Worksheets</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Configure retake policies and review per-student attempts.
          </p>
          <div className="mt-3 grid gap-2">
            {(quizzes ?? []).map((q) => {
              const course = (courses ?? []).find((c) => c.id === q.course_id);
              const st = courseStyle(course?.color ?? "indigo");
              return (
                <MotionCard key={q.id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", st.soft)}>{course?.code ?? "—"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{q.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.allow_retake
                        ? q.max_attempts === 0
                          ? "Retakes allowed · unlimited attempts"
                          : `Retakes allowed · up to ${q.max_attempts} attempt${q.max_attempts === 1 ? "" : "s"}`
                        : "Single attempt"}
                      {" · "}
                      {POLICY_LABELS[q.retake_score_policy]}
                    </p>
                  </div>
                  <button
                    onClick={() => openPolicy(q)}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Policy
                  </button>
                  <button
                    onClick={() => setRosterQuiz(q)}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15"
                  >
                    <Users className="h-3.5 w-3.5" /> Attempts
                  </button>
                  <button
                    onClick={() => openQuizEdit(q)}
                    aria-label={`Edit worksheet ${q.title}`}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setRemoveTarget({ kind: "quiz", id: q.id, title: q.title })}
                    aria-label={`Remove worksheet ${q.title}`}
                    className="flex h-9 items-center rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-full">
                    <MaterialManager target="quiz" id={q.id} courseId={q.course_id} attachments={q.attachments ?? []} />
                  </div>
                </MotionCard>
              );
            })}
          </div>
        </section>
      )}

      {(assignments ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold">Assignments</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Edit instructions, attach handouts, or archive posted work.
          </p>
          <div className="mt-3 grid gap-2">
            {(assignments ?? []).map((a) => {
              const course = (courses ?? []).find((c) => c.id === a.course_id);
              const st = courseStyle(course?.color ?? "indigo");
              return (
                <MotionCard key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", st.soft)}>{course?.code ?? "—"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {COMPONENT_LABELS[a.component_type]} · {a.total_points} pts
                      {a.due_date ? ` · due ${new Date(a.due_date).toLocaleDateString()}` : " · no due date"}
                    </p>
                  </div>
                  <button
                    onClick={() => openAssignEdit(a)}
                    aria-label={`Edit assignment ${a.title}`}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setRemoveTarget({ kind: "assignment", id: a.id, title: a.title })}
                    aria-label={`Remove assignment ${a.title}`}
                    className="flex h-9 items-center rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-full">
                    <MaterialManager target="assignment" id={a.id} courseId={a.course_id} attachments={a.attachments ?? []} />
                  </div>
                </MotionCard>
              );
            })}
          </div>
        </section>
      )}

      <Modal
        open={modal === "course"}
        onClose={() => {
          setModal(null);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.code}` : "New course"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={courseForm.title} onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))} placeholder="Course title *" className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-2" />
          <input value={courseForm.code} onChange={(e) => setCourseForm((f) => ({ ...f, code: e.target.value }))} placeholder="Code (e.g. MATH10) *" className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <select value={courseForm.grade_level} onChange={(e) => setCourseForm((f) => ({ ...f, grade_level: e.target.value }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
            {[7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
          <select value={courseForm.teacher_id} onChange={(e) => setCourseForm((f) => ({ ...f, teacher_id: e.target.value }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-2">
            <option value="">Assign teacher…</option>
            {(teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <div className="flex gap-2 sm:col-span-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setCourseForm((f) => ({ ...f, color: c }))} className={cn("h-8 w-8 rounded-full", courseStyle(c).chip, courseForm.color === c ? "ring-2 ring-ring ring-offset-2" : "opacity-50")} title={c} />
            ))}
          </div>

          {/* Weekly timetable matrix — feeds the schedule-aware tap engine */}
          <fieldset className="rounded-xl border border-border p-3 sm:col-span-2">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">
              Class schedule (optional) — drives on-time/late taps
            </legend>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of week">
              {DAYS.map((d) => {
                const active = courseForm.days.includes(d.code);
                return (
                  <button
                    key={d.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setCourseForm((f) => ({
                        ...f,
                        days: active ? f.days.filter((x) => x !== d.code) : [...f.days, d.code],
                      }))
                    }
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {courseForm.days.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Start time
                  <input
                    type="time"
                    aria-label="Class start time"
                    value={courseForm.start_time}
                    onChange={(e) => setCourseForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  End time
                  <input
                    type="time"
                    aria-label="Class end time"
                    value={courseForm.end_time}
                    onChange={(e) => setCourseForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Late after (min)
                  <input
                    inputMode="numeric"
                    aria-label="Late threshold in minutes"
                    value={courseForm.grace}
                    onChange={(e) => setCourseForm((f) => ({ ...f, grace: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>
            )}
          </fieldset>
        </div>
        <button onClick={saveCourse} disabled={saving} className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : editing ? "Save changes" : "Create course"}
        </button>
      </Modal>

      <Modal open={modal === "assignment"} onClose={() => setModal(null)} title="Post assignment">
        <div className="grid gap-3">
          <select value={assignForm.course_id} onChange={(e) => setAssignForm((f) => ({ ...f, course_id: e.target.value }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select course *</option>
            {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </select>
          <input value={assignForm.title} onChange={(e) => setAssignForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title *" className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <textarea value={assignForm.description} onChange={(e) => setAssignForm((f) => ({ ...f, description: e.target.value }))} placeholder="Instructions" rows={3} className="rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <PendingDropzone files={assignFiles} onChange={setAssignFiles} progress={assignUploadPct} busy={saving} />
          <div className="grid grid-cols-3 gap-3">
            <input type="datetime-local" value={assignForm.due_date} onChange={(e) => setAssignForm((f) => ({ ...f, due_date: e.target.value }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input value={assignForm.total_points} onChange={(e) => setAssignForm((f) => ({ ...f, total_points: e.target.value }))} placeholder="Points" inputMode="numeric" className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <select value={assignForm.component_type} onChange={(e) => setAssignForm((f) => ({ ...f, component_type: e.target.value as typeof f.component_type }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              {Object.entries(COMPONENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <button onClick={saveAssignment} disabled={saving} className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saving ? "Posting…" : "Post assignment"}
        </button>
      </Modal>

      <Modal open={modal === "quiz"} onClose={() => setModal(null)} title="Create worksheet" wide>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={quizForm.course_id} onChange={(e) => setQuizForm((f) => ({ ...f, course_id: e.target.value }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-2">
              <option value="">Select course *</option>
              {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
            </select>
            <input value={quizForm.duration_minutes} onChange={(e) => setQuizForm((f) => ({ ...f, duration_minutes: e.target.value }))} placeholder="Minutes" inputMode="numeric" className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <input value={quizForm.title} onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))} placeholder="Worksheet title *" className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <PolicyFields value={quizForm} onChange={(patch) => setQuizForm((f) => ({ ...f, ...patch }))} />
          <textarea
            value={quizForm.questions}
            onChange={(e) => setQuizForm((f) => ({ ...f, questions: e.target.value }))}
            rows={9}
            placeholder={"Paste a ClassMate worksheet (Sections I–IV + Answer Key):\n\nSection I: Multiple Choice\n1. What is 7 × 8?\nA. 54\nB. 56\nC. 63\nD. 48\n\nSection II: Fill in the Blank\n2. Water boils at ______ °C.\n…\n\nAnswer Key:\n1. B - 7 groups of 8 make 56\n2. 100 (Acceptable: one hundred)\n\n—or one per line: Question | A, B, C, D | answer"}
            className="rounded-xl border border-input bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              const course = (courses ?? []).find((c) => c.id === quizForm.course_id);
              if (!course) {
                toast.error("Select a course first — ClassMate will use it as the worksheet context.");
                return;
              }
              openWorksheetChat({
                course: `${course.code} — ${course.title}`,
                title: quizForm.title.trim(),
              });
              toast.success("ClassMate has your course & title — tell it the topic and item count.");
            }}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/15"
          >
            <Sparkles className="h-4 w-4" /> Generate with ClassMate
          </button>
          <button onClick={saveQuiz} disabled={saving} className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? "Creating…" : "Create worksheet"}
          </button>
        </div>
      </Modal>

      <Modal open={!!policyQuiz} onClose={() => setPolicyQuiz(null)} title={`Retake policy — ${policyQuiz?.title ?? ""}`}>
        <PolicyFields value={policyForm} onChange={(patch) => setPolicyForm((f) => ({ ...f, ...patch }))} />
        <button
          onClick={savePolicy}
          disabled={saving}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save policy"}
        </button>
      </Modal>

      <Modal open={!!editQuiz} onClose={() => setEditQuiz(null)} title={`Edit worksheet — ${editQuiz?.title ?? ""}`} wide>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={editQuizForm.title}
              onChange={(e) => setEditQuizForm((f) => ({ ...f, title: e.target.value }))}
              aria-label="Worksheet title"
              placeholder="Worksheet title *"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-2"
            />
            <input
              value={editQuizForm.duration_minutes}
              onChange={(e) => setEditQuizForm((f) => ({ ...f, duration_minutes: e.target.value }))}
              aria-label="Duration in minutes"
              placeholder="Minutes"
              inputMode="numeric"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <PolicyFields value={editQuizForm} onChange={(patch) => setEditQuizForm((f) => ({ ...f, ...patch }))} />
          <label className="text-xs font-semibold text-muted-foreground">
            Replace questions &amp; answer key (optional)
            <textarea
              value={editQuizForm.questions}
              onChange={(e) => setEditQuizForm((f) => ({ ...f, questions: e.target.value }))}
              rows={7}
              placeholder="Leave blank to keep the current items. Pasting a new worksheet replaces every item and clears prior attempts."
              className="mt-1 w-full rounded-xl border border-input bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {editQuiz && (
            <MaterialManager target="quiz" id={editQuiz.id} courseId={editQuiz.course_id} attachments={editQuiz.attachments ?? []} />
          )}
        </div>
        <button
          onClick={saveQuizEdit}
          disabled={saving}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save worksheet"}
        </button>
      </Modal>

      <Modal open={!!editAssign} onClose={() => setEditAssign(null)} title={`Edit assignment — ${editAssign?.title ?? ""}`}>
        <div className="grid gap-3">
          <input
            value={editAssignForm.title}
            onChange={(e) => setEditAssignForm((f) => ({ ...f, title: e.target.value }))}
            aria-label="Assignment title"
            placeholder="Title *"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={editAssignForm.description}
            onChange={(e) => setEditAssignForm((f) => ({ ...f, description: e.target.value }))}
            aria-label="Instructions"
            placeholder="Instructions"
            rows={3}
            className="rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              type="datetime-local"
              aria-label="Due date"
              value={editAssignForm.due_date}
              onChange={(e) => setEditAssignForm((f) => ({ ...f, due_date: e.target.value }))}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={editAssignForm.total_points}
              onChange={(e) => setEditAssignForm((f) => ({ ...f, total_points: e.target.value }))}
              aria-label="Total points"
              placeholder="Points"
              inputMode="numeric"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={editAssignForm.component_type}
              onChange={(e) => setEditAssignForm((f) => ({ ...f, component_type: e.target.value as Assignment["component_type"] }))}
              aria-label="Grading component"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(COMPONENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {editAssign && (
            <MaterialManager target="assignment" id={editAssign.id} courseId={editAssign.course_id} attachments={editAssign.attachments ?? []} />
          )}
        </div>
        <button
          onClick={saveAssignEdit}
          disabled={saving}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save assignment"}
        </button>
      </Modal>

      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title={`Remove ${removeTarget?.kind === "quiz" ? "worksheet" : "assignment"}`}>
        <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            <span className="font-semibold">{removeTarget?.title}</span> — archiving hides it from students while keeping
            every score, attempt, and audit record. Permanent deletion also erases attached files and cannot be undone.
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => confirmRemove("soft")}
            disabled={saving}
            className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Archive (keep records)
          </button>
          <button
            onClick={() => confirmRemove("hard")}
            disabled={saving}
            className="h-11 rounded-xl border border-rose-500/40 bg-rose-500/10 text-sm font-semibold text-rose-600 hover:bg-rose-500/15 disabled:opacity-50"
          >
            Delete permanently
          </button>
        </div>
      </Modal>

      <Modal open={!!rosterQuiz} onClose={() => setRosterQuiz(null)} title={`Attempts — ${rosterQuiz?.title ?? ""}`} wide>
        {rosterQuiz && <AttemptRoster quizId={rosterQuiz.id} />}
      </Modal>
    </AppShell>
  );
}

/** Shared Submission & Retake Policies card (creation + edit modals). */
function PolicyFields({
  value,
  onChange,
}: {
  value: typeof EMPTY_POLICY;
  onChange: (patch: Partial<typeof EMPTY_POLICY>) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">
        Submission &amp; Retake Policies
      </legend>
      <div className="flex items-center justify-between gap-3 py-1">
        <span className="text-sm font-medium">Allow students to retake this worksheet</span>
        <button
          type="button"
          role="switch"
          aria-checked={value.allow_retake}
          aria-label="Allow students to retake this worksheet"
          onClick={() => onChange({ allow_retake: !value.allow_retake })}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition",
            value.allow_retake ? "bg-primary" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
              value.allow_retake ? "left-[22px]" : "left-0.5",
            )}
          />
        </button>
      </div>
      {value.allow_retake ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={value.unlimited}
                onChange={(e) => onChange({ unlimited: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              Unlimited attempts
            </label>
            {!value.unlimited && (
              <input
                inputMode="numeric"
                aria-label="Maximum allowed attempts"
                value={value.max_attempts}
                onChange={(e) => onChange({ max_attempts: e.target.value })}
                placeholder="Max attempts (e.g. 3)"
                className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            )}
          </div>
          <label className="text-xs font-medium text-muted-foreground">
            Grading policy
            <select
              aria-label="Grading policy"
              value={value.retake_score_policy}
              onChange={(e) => onChange({ retake_score_policy: e.target.value as RetakePolicy })}
              className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(POLICY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Students get exactly one attempt unless you grant an individual retake later.
        </p>
      )}
    </fieldset>
  );
}

/** Staff roster of per-student attempts with grant/reset overrides. */
function AttemptRoster({ quizId }: { quizId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["quiz-attempts", quizId],
    queryFn: () => listQuizAttempts(quizId),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["quiz-attempts", quizId] });

  const grant = async (studentId: string) => {
    setBusy(studentId);
    try {
      await grantQuizRetake(quizId, studentId);
      toast.success("Extra attempt granted.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not grant a retake.");
    } finally {
      setBusy(null);
    }
  };

  const reset = async (studentId: string, name: string) => {
    if (!confirm(`Reset all attempts for ${name}? Their attempt history on this worksheet will be wiped.`)) return;
    setBusy(studentId);
    try {
      await resetQuizAttempts(quizId, studentId);
      toast.success("Attempts reset.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset attempts.");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading attempts…</p>;
  if (!data || data.students.length === 0) {
    return <EmptyState title="No attempts yet" sub="No student has submitted this worksheet." />;
  }

  return (
    <div className="space-y-3">
      {data.students.map((s) => (
        <div key={s.student_id} className="rounded-xl border border-border/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{s.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {s.student_no ?? "—"}
                {s.section ? ` · ${s.section}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {s.effective_score != null && (
                <Badge tone="green">
                  Effective: {s.effective_score}/{s.effective_total}
                </Badge>
              )}
              {s.extra_attempts > 0 && <Badge tone="amber">+{s.extra_attempts} granted</Badge>}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.attempts.map((a) => (
              <span key={a.attempt_number} className="rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold">
                #{a.attempt_number}: {a.score}/{a.total}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => grant(s.student_id)}
              disabled={busy === s.student_id}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Grant extra retake
            </button>
            <button
              onClick={() => reset(s.student_id, s.full_name)}
              disabled={busy === s.student_id}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"
            >
              <Eraser className="h-3.5 w-3.5" /> Reset attempts
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EnrollmentCount({ courseId }: { courseId: string }) {
  const { data } = useQuery({ queryKey: ["enrollments", courseId], queryFn: () => enrollmentsForCourse(courseId) });
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <Plus className="hidden" />
      {data?.length ?? 0} students enrolled
    </p>
  );
}

const ACCEPTED = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_BATCH_BYTES = 60 * 1024 * 1024;
const ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];

/** MIME/extension + size validation shared by the staged dropzone. */
function isAcceptedFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (ACCEPTED_MIME.includes(file.type)) return true;
  return /\.(pdf|docx?|png|jpe?g|zip)$/i.test(file.name);
}

/**
 * Staged drag-and-drop zone used before the record exists (create forms).
 * Files are held in local state and uploaded once the item is posted.
 */
function PendingDropzone({
  files,
  onChange,
  progress,
  busy,
}: {
  files: File[];
  onChange: (next: File[]) => void;
  progress?: number;
  busy?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const add = (incoming: FileList | File[]) => {
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (!isAcceptedFile(file)) {
        toast.error(`${file.name} is not a supported format.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is over 25 MB.`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      if (next.reduce((s, f) => s + f.size, 0) + file.size > MAX_BATCH_BYTES) {
        toast.error("Batch is too large (max 60 MB total).");
        break;
      }
      next.push(file);
    }
    onChange(next);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Attach reference materials"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) add(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-5 text-center transition",
          drag
            ? "border-primary bg-primary/10 ring-2 ring-primary/40"
            : "border-border hover:border-primary/50 hover:bg-muted/60",
        )}
      >
        <CloudUpload className={cn("h-6 w-6", drag ? "text-primary" : "text-muted-foreground")} />
        <p className="text-sm font-semibold">Drag and drop files here, or browse</p>
        <p className="text-xs text-muted-foreground">Supports PDF, DOCX, PNG, JPG, ZIP (Max: 25MB)</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          aria-label="Reference materials"
          onChange={(e) => {
            if (e.target.files?.length) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{f.name}</span>
              <span className="text-[11px] text-muted-foreground">{formatFileSize(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x !== f))}
                disabled={busy}
                aria-label={`Remove ${f.name}`}
                className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy && typeof progress === "number" && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}


/**
 * Drag-and-drop material uploader + attachment list for one worksheet or
 * assignment. Uploads go to the private course-materials bucket; the server
 * verifies the caller is an admin or the course lead before accepting a file.
 */
function MaterialManager({
  target,
  id,
  courseId,
  attachments,
}: {
  target: "quiz" | "assignment";
  id: string;
  courseId: string;
  attachments: Attachment[];
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<Attachment[]>(attachments);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [target === "quiz" ? "quizzes" : "assignments"] });

  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name} is over 25 MB.`);
          continue;
        }
        const attachment = await uploadCourseMaterial(courseId, file);
        setItems(await attachCourseMaterial(target, id, attachment));
        toast.success(`${file.name} attached.`);
      }
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      setDrag(false);
    }
  };

  const detach = async (a: Attachment) => {
    setBusy(true);
    try {
      setItems(await removeCourseMaterial(target, id, a.path));
      toast.success("File removed.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-dashed border-border p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" /> Materials
      </div>
      {items.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {items.map((a) => (
            <li key={a.path} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5">
              <a
                href={materialHref(a)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-xs font-medium text-primary hover:underline"
              >
                {a.name}
              </a>
              <span className="text-[11px] text-muted-foreground">{formatFileSize(a.size)}</span>
              <button
                onClick={() => detach(a)}
                disabled={busy}
                aria-label={`Remove ${a.name}`}
                className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
        className={cn(
          "mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs font-medium transition",
          drag ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? "Uploading…" : "Drop files here or browse — PDF, DOCX, PNG, JPG, ZIP (Max: 25MB)"}
        <input
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          aria-label="Upload course material"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

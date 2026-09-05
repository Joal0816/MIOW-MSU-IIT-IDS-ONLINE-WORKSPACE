import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  CloudUpload,
  Eraser,
  FileQuestion,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { extractTextFromFile, isWorksheetAcceptedFile } from "@/lib/extract-text";
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
import {
  staffNav,
  AppShell,
  Badge,
  EmptyState,
  Modal,
  MotionCard,
  courseStyle,
  useProfile,
} from "@/components/lms";
import { parseWorksheet } from "@/lib/worksheet-parser";
import { openWorksheetChat } from "@/lib/worksheet-context";
import { COURSE_LEVELS, collegeYearOf, educationLevelOf, levelLabel } from "@/lib/course-levels";
import { CED_PROGRAMS, CED_DEPARTMENT_LABELS } from "@/lib/ced-programs";
import { cn } from "@/lib/utils";
import {
  COLORS,
  DAYS,
  EMPTY_COURSE,
  WIZARD_STEPS,
  EMPTY_POLICY,
  EMPTY_MANUAL_Q,
  POLICY_LABELS,
  ACCEPTED,
  MAX_FILE_BYTES,
  COURSE_MATERIAL_MAX_BYTES,
  isAcceptedFile,
  policyPayload,
  type WizardStep,
  type QuizMode,
  type ManualQuestion,
} from "@/components/courses/constants";
import { PolicyFields } from "@/components/courses/policy-fields";
import { AttemptRoster } from "@/components/courses/attempt-roster";
import { EnrollmentCount } from "@/components/courses/enrollment-count";
import { PendingDropzone } from "@/components/courses/pending-dropzone";
import { MaterialManager } from "@/components/courses/material-manager";

export const Route = createFileRoute("/dashboard/admin/courses")({
  head: () => ({
    meta: [
      { title: "Courses | MIOW - Integrated Developmental School" },
      { name: "description", content: "Manage courses, assignments and worksheets." },
      { property: "og:title", content: "Courses | MIOW - Integrated Developmental School" },
      { property: "og:description", content: "Manage courses, assignments and worksheets." },
    ],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const profile = useProfile(["admin", "teacher"]);
  const qc = useQueryClient();
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
    enabled: !!profile,
  });
  // Course-lead picker source: TEACHERS only — admin accounts never appear.
  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: listTeachers,
    enabled: !!profile,
  });
  const { data: quizzes } = useQuery({
    queryKey: ["quizzes"],
    queryFn: listQuizzes,
    enabled: !!profile,
  });
  const { data: assignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: listAssignments,
    enabled: !!profile,
  });

  const [modal, setModal] = useState<"course" | "assignment" | "quiz" | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE);
  const [assignForm, setAssignForm] = useState({
    course_id: "",
    title: "",
    description: "",
    due_date: "",
    total_points: "100",
    component_type: "written_work" as const,
  });
  const [quizForm, setQuizForm] = useState({
    ...EMPTY_POLICY,
    course_id: "",
    title: "",
    duration_minutes: "15",
    questions: "",
  });
  const [quizMode, setQuizMode] = useState<QuizMode>("classmate");
  const [manualQuestions, setManualQuestions] = useState<ManualQuestion[]>([]);
  const [quizFileDrag, setQuizFileDrag] = useState(false);
  const [quizFileName, setQuizFileName] = useState<string | null>(null);
  // Files staged in the "Post assignment" form, uploaded once the row exists.
  const [assignFiles, setAssignFiles] = useState<File[]>([]);
  const [assignUploadPct, setAssignUploadPct] = useState(0);
  const [wizardStep, setWizardStep] = useState<WizardStep>("basic");
  const [policyQuiz, setPolicyQuiz] = useState<Quiz | null>(null);
  const [policyForm, setPolicyForm] = useState(EMPTY_POLICY);
  const [rosterQuiz, setRosterQuiz] = useState<Quiz | null>(null);
  // Content editing / removal state (worksheets + assignments)
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null);
  const [editQuizForm, setEditQuizForm] = useState({
    ...EMPTY_POLICY,
    title: "",
    duration_minutes: "15",
    questions: "",
    score_released: false,
    answer_key_released: false,
  });
  const [editAssign, setEditAssign] = useState<Assignment | null>(null);
  const [editAssignForm, setEditAssignForm] = useState({
    title: "",
    description: "",
    due_date: "",
    total_points: "100",
    component_type: "written_work" as Assignment["component_type"],
  });
  const [removeTarget, setRemoveTarget] = useState<{
    kind: "quiz" | "assignment";
    id: string;
    title: string;
  } | null>(null);

  if (!profile) return null;

  // Course lifecycle (create / delete / lead reassignment) is admin-only;
  // teachers may only edit metadata on courses they lead.
  const isAdmin = profile.role === "admin";

  const refresh = () => qc.invalidateQueries({ queryKey: ["courses"] });

  const openEdit = (c: Course) => {
    setEditing(c);
    setWizardStep("basic");
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
      strand: c.strand ?? "",
      program: c.program ?? "",
    });
    setModal("course");
  };

  const saveCourse = async () => {
    if (!courseForm.title || !courseForm.code) {
      toast.error("Title and code are required.");
      return;
    }
    const lvl = parseInt(courseForm.grade_level);
    if (Number.isNaN(lvl) || lvl < 7 || lvl > 16) {
      toast.error("Level must be Grade 7 – College 4th Year (7–16).");
      return;
    }
    if ((lvl === 11 || lvl === 12) && !courseForm.strand) {
      toast.error("Please select a strand for SHS (G11–G12).");
      return;
    }
    if (lvl >= 13 && lvl <= 16 && !courseForm.program?.trim()) {
      toast.error("Please enter a program for College (e.g. BSIT, BSED).");
      return;
    }
    if (courseForm.days.length > 0 && (!courseForm.start_time || !courseForm.end_time)) {
      toast.error("Set both a start and end time for the scheduled days (or clear the days).");
      return;
    }
    setSaving(true);
    try {
      const education_level = educationLevelOf(lvl);
      const college_year = collegeYearOf(lvl);
      const payload = {
        title: courseForm.title,
        code: courseForm.code,
        grade_level: lvl,
        education_level,
        college_year,
        strand: lvl >= 11 && lvl <= 12 ? courseForm.strand || null : null,
        program: lvl >= 13 ? courseForm.program?.trim() || null : null,
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
      setWizardStep("basic");
      refresh();
    } catch {
      toast.error(editing ? "Could not update course." : "Could not create course.");
    } finally {
      setSaving(false);
    }
  };

  const removeCourse = async (c: Course) => {
    if (
      !confirm(
        `Delete ${c.code} — ${c.title}? Its assignments and worksheets will also be removed.`,
      )
    )
      return;
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
        try {
          attachments.push(await uploadCourseMaterial(assignForm.course_id, assignFiles[i]!));
        } catch (e) {
          toast.error(
            `Failed to upload ${assignFiles[i]!.name}: ${e instanceof Error ? e.message : "Upload error"}`,
          );
          setSaving(false);
          setAssignUploadPct(0);
          return;
        }
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
      setAssignForm({
        course_id: "",
        title: "",
        description: "",
        due_date: "",
        total_points: "100",
        component_type: "written_work",
      });
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

    let questions: Array<{ question: string; options: string[]; correct_answer: string }>;

    if (quizMode === "manual") {
      // Manual mode: convert structured questions directly
      const valid = manualQuestions.filter((q) => q.question.trim() && q.correct_answer.trim());
      if (valid.length === 0) {
        toast.error("Add at least one question with a question text and correct answer.");
        return;
      }
      questions = valid.map((q) => ({
        question: q.question.trim(),
        options: q.kind === "mc" ? q.options.filter(Boolean) : [],
        correct_answer: q.correct_answer.trim(),
      }));
    } else {
      // ClassMate mode: parse the textarea content
      const parsed = parseWorksheet(quizForm.questions);
      if (!parsed.questions.length) {
        toast.error(
          "No valid questions found — paste the four-section worksheet (with its Answer Key), upload a file, or use 'Generate with ClassMate'.",
        );
        return;
      }
      if (parsed.dropped > 0) {
        toast.warning(
          `${parsed.dropped} item${parsed.dropped > 1 ? "s were" : " was"} skipped — check their numbering against the Answer Key.`,
        );
      }
      questions = parsed.questions;
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
      setQuizForm({
        ...EMPTY_POLICY,
        course_id: "",
        title: "",
        duration_minutes: "15",
        questions: "",
      });
      setManualQuestions([]);
      setQuizMode("classmate");
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
      score_released: !!q.score_released,
      answer_key_released: !!q.answer_key_released,
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
    let questions:
      Array<{ question: string; options: string[]; correct_answer: string }> | undefined;
    if (editQuizForm.questions.trim()) {
      const parsed = parseWorksheet(editQuizForm.questions);
      if (!parsed.questions.length) {
        toast.error("No valid questions found in the replacement content.");
        return;
      }
      if (parsed.dropped > 0)
        toast.warning(`${parsed.dropped} item(s) skipped — check the Answer Key numbering.`);
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
          score_released: !!editQuizForm.score_released,
          answer_key_released: !!editQuizForm.answer_key_released,
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
    <AppShell
      nav={staffNav(profile.role)}
      profile={profile}
      subtitle={profile.role === "admin" ? "MIOW Admin Console" : "MIOW Teacher Portal"}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {courses?.length ?? 0} active courses
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              onClick={() => {
                setEditing(null);
                setCourseForm(EMPTY_COURSE);
                setWizardStep("basic");
                setModal("course");
              }}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <BookOpen className="h-4 w-4" /> Course
            </button>
          )}
          <button
            onClick={() => setModal("assignment")}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <ClipboardList className="h-4 w-4" /> Assignment
          </button>
          <button
            onClick={() => setModal("quiz")}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <FileQuestion className="h-4 w-4" /> Worksheet
          </button>
        </div>
      </div>

      {(courses ?? []).length === 0 ? (
        <EmptyState
          title="No courses yet"
          sub={
            isAdmin
              ? "Create your first course to begin."
              : "An administrator will assign courses to you."
          }
        />
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
                      <Badge tone="slate">{levelLabel(c.grade_level)}</Badge>
                      {(isAdmin || c.teacher_id === profile.id) && (
                        <button
                          onClick={() => openEdit(c)}
                          title="Edit course"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => removeCourse(c)}
                          title="Delete course"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 flex items-center gap-2 font-semibold leading-snug">
                    <span>{c.title}</span>
                    <Badge tone="indigo">{levelLabel(c.grade_level)}</Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.teacher_name ?? "No teacher assigned"}
                  </p>
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
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", st.soft)}>
                    {course?.code ?? "—"}
                  </span>
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
                    <MaterialManager
                      target="quiz"
                      id={q.id}
                      courseId={q.course_id}
                      attachments={q.attachments ?? []}
                    />
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
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", st.soft)}>
                    {course?.code ?? "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {COMPONENT_LABELS[a.component_type]} · {a.total_points} pts
                      {a.due_date
                        ? ` · due ${new Date(a.due_date).toLocaleDateString()}`
                        : " · no due date"}
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
                    onClick={() =>
                      setRemoveTarget({ kind: "assignment", id: a.id, title: a.title })
                    }
                    aria-label={`Remove assignment ${a.title}`}
                    className="flex h-9 items-center rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-full">
                    <MaterialManager
                      target="assignment"
                      id={a.id}
                      courseId={a.course_id}
                      attachments={a.attachments ?? []}
                    />
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
          setWizardStep("basic");
        }}
        title={editing ? `Edit ${editing.code}` : "New course"}
        wide
      >
        {/* Wizard stepper — Basic / Assignment / Schedule */}
        <div className="mb-5 flex items-center gap-1.5">
          {WIZARD_STEPS.map((s, idx) => {
            const isActive = wizardStep === s.id;
            const isPast = WIZARD_STEPS.findIndex((x) => x.id === wizardStep) > idx;
            return (
              <div key={s.id} className="flex flex-1 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setWizardStep(s.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : isPast
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                      isActive
                        ? "bg-white text-primary"
                        : isPast
                          ? "bg-emerald-500 text-white"
                          : "bg-muted-foreground/20",
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.label.slice(0, 3)}</span>
                </button>
                {idx < WIZARD_STEPS.length - 1 && (
                  <span
                    className={cn(
                      "hidden h-px flex-1 sm:block",
                      isPast ? "bg-emerald-500/40" : "bg-border",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Preview — title + level badge */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <div className={cn("h-2.5 w-2.5 rounded-full", courseStyle(courseForm.color).chip)} />
          <span className="truncate text-sm font-semibold">
            {courseForm.title.trim() || "Untitled course"}
          </span>
          <Badge tone="indigo">{levelLabel(parseInt(courseForm.grade_level) || 10)}</Badge>
          {courseForm.code && (
            <span className="text-xs font-medium text-muted-foreground">{courseForm.code}</span>
          )}
          {courseForm.program && parseInt(courseForm.grade_level) >= 13 && (
            <span className="text-xs text-muted-foreground">· {courseForm.program}</span>
          )}
          {courseForm.strand &&
            (courseForm.grade_level === "11" || courseForm.grade_level === "12") && (
              <span className="text-xs text-muted-foreground">· {courseForm.strand}</span>
            )}
        </div>

        {/* Step: Basic */}
        {wizardStep === "basic" && (
          <div className="grid gap-3">
            <input
              value={courseForm.title}
              onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Course title * (e.g. Mathematics 7)"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={courseForm.code}
                onChange={(e) => setCourseForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="Code * (e.g. MATH7)"
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Level *
                </label>
                <select
                  value={courseForm.grade_level}
                  onChange={(e) => setCourseForm({ ...courseForm, grade_level: e.target.value })}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Course level"
                >
                  {COURSE_LEVELS.map((lv) => (
                    <option key={lv.value} value={String(lv.value)}>
                      {lv.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {(() => {
                    const n = parseInt(courseForm.grade_level) || 10;
                    const edu = educationLevelOf(n);
                    const yr = collegeYearOf(n);
                    return edu === "college"
                      ? `College Year ${yr} · college`
                      : edu === "shs"
                        ? "Senior High (SHS)"
                        : "Junior High (JHS)";
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step: Assignment */}
        {wizardStep === "assignment" && (
          <div className="grid gap-3">
            {isAdmin ? (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Course lead (teacher)
                </span>
                <select
                  aria-label="Course lead"
                  value={courseForm.teacher_id}
                  onChange={(e) => setCourseForm((f) => ({ ...f, teacher_id: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Assign teacher…</option>
                  {(teachers ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                Course leads are assigned by administrators.
              </p>
            )}
            {(courseForm.grade_level === "11" || courseForm.grade_level === "12") && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Strand (SHS) *
                </span>
                <select
                  value={courseForm.strand ?? ""}
                  onChange={(e) => setCourseForm({ ...courseForm, strand: e.target.value })}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select strand</option>
                  <option value="STEM">STEM</option>
                  <option value="ABM">ABM</option>
                  <option value="HUMSS">HUMSS</option>
                  <option value="GAS">GAS</option>
                  <option value="TVL">TVL</option>
                </select>
              </label>
            )}
            {(courseForm.grade_level === "13" ||
              courseForm.grade_level === "14" ||
              courseForm.grade_level === "15" ||
              courseForm.grade_level === "16") && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Program (College) *
                </span>
                <select
                  value={courseForm.program ?? ""}
                  onChange={(e) => setCourseForm({ ...courseForm, program: e.target.value })}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select program</option>
                  {(["SME", "PRE", "PE", "TTE"] as const).map((dept) => {
                    const progs = CED_PROGRAMS.filter((p) => p.department === dept);
                    if (!progs.length) return null;
                    return (
                      <optgroup key={dept} label={CED_DEPARTMENT_LABELS[dept]}>
                        {progs.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </label>
            )}
            <div>
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Accent color
              </span>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourseForm((f) => ({ ...f, color: c }))}
                    className={cn(
                      "h-8 w-8 rounded-full",
                      courseStyle(c).chip,
                      courseForm.color === c ? "ring-2 ring-ring ring-offset-2" : "opacity-60",
                    )}
                    title={c}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step: Schedule */}
        {wizardStep === "schedule" && (
          <fieldset className="rounded-xl border border-border p-3">
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
        )}

        <div className="mt-5 flex gap-2">
          {wizardStep !== "basic" ? (
            <button
              type="button"
              onClick={() => setWizardStep((s) => (s === "schedule" ? "assignment" : "basic"))}
              className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-muted"
            >
              Back
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {wizardStep !== "schedule" ? (
            <button
              type="button"
              onClick={() => setWizardStep((s) => (s === "basic" ? "assignment" : "schedule"))}
              className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Next
            </button>
          ) : (
            <button
              onClick={saveCourse}
              disabled={saving}
              className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Create course"}
            </button>
          )}
        </div>
      </Modal>

      <Modal open={modal === "assignment"} onClose={() => setModal(null)} title="Post assignment">
        <div className="grid gap-3">
          <select
            value={assignForm.course_id}
            onChange={(e) => setAssignForm((f) => ({ ...f, course_id: e.target.value }))}
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select course *</option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
          <input
            value={assignForm.title}
            onChange={(e) => setAssignForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title *"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={assignForm.description}
            onChange={(e) => setAssignForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Instructions"
            rows={3}
            className="rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <PendingDropzone
            files={assignFiles}
            onChange={setAssignFiles}
            progress={assignUploadPct}
            busy={saving}
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              type="datetime-local"
              value={assignForm.due_date}
              onChange={(e) => setAssignForm((f) => ({ ...f, due_date: e.target.value }))}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={assignForm.total_points}
              onChange={(e) => setAssignForm((f) => ({ ...f, total_points: e.target.value }))}
              placeholder="Points"
              inputMode="numeric"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={assignForm.component_type}
              onChange={(e) =>
                setAssignForm((f) => ({
                  ...f,
                  component_type: e.target.value as typeof f.component_type,
                }))
              }
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(COMPONENT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={saveAssignment}
          disabled={saving}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post assignment"}
        </button>
      </Modal>

      <Modal
        open={modal === "quiz"}
        onClose={() => {
          setModal(null);
          setQuizMode("classmate");
          setManualQuestions([]);
          setQuizFileName(null);
        }}
        title="Create worksheet"
        wide
      >
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={quizForm.course_id}
              onChange={(e) => setQuizForm((f) => ({ ...f, course_id: e.target.value }))}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-2"
            >
              <option value="">Select course *</option>
              {(courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
            <input
              value={quizForm.duration_minutes}
              onChange={(e) => setQuizForm((f) => ({ ...f, duration_minutes: e.target.value }))}
              placeholder="Minutes"
              inputMode="numeric"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <input
            value={quizForm.title}
            onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Worksheet title *"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <PolicyFields
            value={quizForm}
            onChange={(patch) => setQuizForm((f) => ({ ...f, ...patch }))}
          />

          {/* ── Mode tabs ────────────────────────────────────────────── */}
          <div className="flex gap-2 rounded-xl border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setQuizMode("classmate")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                quizMode === "classmate"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" /> Generate with ClassMate
            </button>
            <button
              type="button"
              onClick={() => setQuizMode("manual")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                quizMode === "manual"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <FileText className="h-3.5 w-3.5" /> Manual Entry
            </button>
          </div>

          {/* ── ClassMate mode: file upload + textarea ─────────────── */}
          {quizMode === "classmate" && (
            <>
              {/* ── File dropzone ──────────────────────────────────────── */}
              {quizFileName ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="flex-1 truncate text-xs font-semibold">{quizFileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuizFileName(null);
                      setQuizForm((f) => ({ ...f, questions: "" }));
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setQuizFileDrag(true);
                  }}
                  onDragLeave={() => setQuizFileDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setQuizFileDrag(false);
                    const file = e.dataTransfer.files?.[0];
                    if (!file) return;
                    if (!isWorksheetAcceptedFile(file)) {
                      toast.error("Only .txt, .md, .pdf, and .docx files are supported.");
                      return;
                    }
                    if (file.size > COURSE_MATERIAL_MAX_BYTES) {
                      toast.error("File is too large (max 10MB).");
                      return;
                    }
                    extractTextFromFile(file)
                      .then((text) => {
                        setQuizFileName(file.name);
                        setQuizForm((f) => ({ ...f, questions: text }));
                        const { questions, dropped } = parseWorksheet(text);
                        if (questions.length > 0) {
                          toast.success(
                            `Loaded ${questions.length} question(s) from file${dropped ? ` (${dropped} skipped)` : ""}`,
                          );
                        } else {
                          // Raw content (e.g. PDF lecture material) — send to ClassMate for question generation
                          const course = (courses ?? []).find((c) => c.id === quizForm.course_id);
                          if (course && quizForm.title.trim()) {
                            openWorksheetChat({
                              course: `${course.code} — ${course.title}`,
                              title: quizForm.title.trim(),
                              sourceMaterial: text,
                            });
                            toast.success(
                              "File loaded — ClassMate is ready to generate questions from it.",
                            );
                          } else {
                            toast.success(
                              "File loaded. Select a course and title, then click 'Generate with ClassMate'.",
                            );
                          }
                        }
                      })
                      .catch((err) => {
                        console.error(err);
                        toast.error(
                          "Could not extract text from this file. Try a different file or paste the content directly.",
                        );
                      });
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-5 text-center transition",
                    quizFileDrag
                      ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                      : "border-border hover:border-primary/50 hover:bg-muted/60",
                  )}
                >
                  <CloudUpload
                    className={cn(
                      "h-5 w-5",
                      quizFileDrag ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <p className="text-xs font-semibold">
                    Drag & drop a file here, or click to browse
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Supports .txt, .md, .pdf, .docx (Max 10MB) — optional, for source material
                    context.
                  </p>
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!isWorksheetAcceptedFile(file)) {
                        toast.error("Only .txt, .md, .pdf, and .docx files are supported.");
                        e.target.value = "";
                        return;
                      }
                      if (file.size > COURSE_MATERIAL_MAX_BYTES) {
                        toast.error("File is too large (max 10MB).");
                        e.target.value = "";
                        return;
                      }
                      extractTextFromFile(file)
                        .then((text) => {
                          setQuizFileName(file.name);
                          setQuizForm((f) => ({ ...f, questions: text }));
                          const { questions, dropped } = parseWorksheet(text);
                          if (questions.length > 0) {
                            toast.success(
                              `Loaded ${questions.length} question(s)${dropped ? ` (${dropped} skipped)` : ""}`,
                            );
                          } else {
                            const course = (courses ?? []).find((c) => c.id === quizForm.course_id);
                            if (course && quizForm.title.trim()) {
                              openWorksheetChat({
                                course: `${course.code} — ${course.title}`,
                                title: quizForm.title.trim(),
                                sourceMaterial: text,
                              });
                              toast.success(
                                "File loaded — ClassMate is ready to generate questions from it.",
                              );
                            } else {
                              toast.success(
                                "File loaded. Select a course and title, then click 'Generate with ClassMate'.",
                              );
                            }
                          }
                        })
                        .catch((err) => {
                          console.error(err);
                          toast.error(
                            "Could not extract text from this file. Try a different file or paste the content directly.",
                          );
                        });
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <label className="text-xs font-semibold text-muted-foreground">
                Or paste questions &amp; answer key
              </label>
              <textarea
                value={quizForm.questions}
                onChange={(e) => setQuizForm((f) => ({ ...f, questions: e.target.value }))}
                rows={9}
                placeholder={
                  "Paste a ClassMate worksheet (Sections I–IV + Answer Key):\n\nSection I: Multiple Choice\n1. What is 7 × 8?\nA. 54\nB. 56\nC. 63\nD. 48\n\nSection II: Fill in the Blank\n2. Water boils at ______ °C.\n…\n\nAnswer Key:\n1. B - 7 groups of 8 make 56\n2. 100 (Acceptable: one hundred)"
                }
                className="rounded-xl border border-input bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => {
                  const course = (courses ?? []).find((c) => c.id === quizForm.course_id);
                  if (!course) {
                    toast.error(
                      "Select a course first — ClassMate will use it as the worksheet context.",
                    );
                    return;
                  }
                  if (!quizForm.title.trim()) {
                    toast.error("Enter a worksheet title first.");
                    return;
                  }
                  openWorksheetChat({
                    course: `${course.code} — ${course.title}`,
                    title: quizForm.title.trim(),
                    ...(quizForm.questions ? { sourceMaterial: quizForm.questions } : {}),
                  });
                  toast.success("ClassMate is ready — tell it the topic and item count.");
                }}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary transition hover:bg-primary/15"
              >
                <Sparkles className="h-4 w-4" />
                Generate with ClassMate
              </button>
            </>
          )}

          {/* ── Manual Entry mode: structured question builder ─────── */}
          {quizMode === "manual" && (
            <>
              {manualQuestions.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm font-semibold">No questions yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click "Add Question" below to start building your worksheet.
                  </p>
                </div>
              )}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {manualQuestions.map((q, qi) => (
                  <div key={qi} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-muted-foreground">Q{qi + 1}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={q.kind}
                          onChange={(e) => {
                            const kind = e.target.value as ManualQuestion["kind"];
                            setManualQuestions((prev) =>
                              prev.map((pq, i) =>
                                i === qi
                                  ? {
                                      ...pq,
                                      kind,
                                      options:
                                        kind === "mc"
                                          ? pq.options.length >= 4
                                            ? pq.options
                                            : ["", "", "", ""]
                                          : [],
                                    }
                                  : pq,
                              ),
                            );
                          }}
                          className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                        >
                          <option value="mc">Multiple Choice</option>
                          <option value="fill">Fill in the Blank</option>
                          <option value="essay">Essay / Short Answer</option>
                          <option value="matching">Matching</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setManualQuestions((prev) => prev.filter((_, i) => i !== qi))
                          }
                          className="rounded-lg p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      value={q.question}
                      onChange={(e) =>
                        setManualQuestions((prev) =>
                          prev.map((pq, i) =>
                            i === qi ? { ...pq, question: e.target.value } : pq,
                          ),
                        )
                      }
                      placeholder={
                        q.kind === "fill"
                          ? "Sentence with ______ blank"
                          : q.kind === "essay"
                            ? "Essay prompt or question"
                            : "Question text"
                      }
                      className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                    />
                    {q.kind === "mc" && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {["A", "B", "C", "D"].map((letter, oi) => (
                          <div key={letter} className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-muted-foreground w-4">
                              {letter}.
                            </span>
                            <input
                              value={q.options[oi] ?? ""}
                              onChange={(e) =>
                                setManualQuestions((prev) => {
                                  const opts = [...(prev[qi]?.options ?? ["", "", "", ""])];
                                  opts[oi] = e.target.value;
                                  return prev.map((pq, i) =>
                                    i === qi ? { ...pq, options: opts } : pq,
                                  );
                                })
                              }
                              placeholder={`Option ${letter}`}
                              className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    {q.kind === "mc" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Correct:
                        </span>
                        <select
                          value={q.correct_answer}
                          onChange={(e) =>
                            setManualQuestions((prev) =>
                              prev.map((pq, i) =>
                                i === qi ? { ...pq, correct_answer: e.target.value } : pq,
                              ),
                            )
                          }
                          className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                        >
                          <option value="">Select answer</option>
                          {q.options.filter(Boolean).map((opt, oi) => (
                            <option key={oi} value={opt}>
                              {String.fromCharCode(65 + oi)}. {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {q.kind === "fill" && (
                      <input
                        value={q.correct_answer}
                        onChange={(e) =>
                          setManualQuestions((prev) =>
                            prev.map((pq, i) =>
                              i === qi ? { ...pq, correct_answer: e.target.value } : pq,
                            ),
                          )
                        }
                        placeholder="Correct answer (e.g. 100)"
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                    {q.kind === "essay" && (
                      <textarea
                        value={q.correct_answer}
                        onChange={(e) =>
                          setManualQuestions((prev) =>
                            prev.map((pq, i) =>
                              i === qi ? { ...pq, correct_answer: e.target.value } : pq,
                            ),
                          )
                        }
                        placeholder="Rubric / key points (e.g. Must mention: photosynthesis, sunlight, chlorophyll)"
                        rows={2}
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                    {q.kind === "matching" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
                            Column A (premises)
                          </p>
                          <textarea
                            value={q.question}
                            onChange={(e) =>
                              setManualQuestions((prev) =>
                                prev.map((pq, i) =>
                                  i === qi ? { ...pq, question: e.target.value } : pq,
                                ),
                              )
                            }
                            placeholder={"1. Premise A\n2. Premise B"}
                            rows={3}
                            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
                            Column B (options)
                          </p>
                          <textarea
                            value={q.options.join("\n")}
                            onChange={(e) =>
                              setManualQuestions((prev) =>
                                prev.map((pq, i) =>
                                  i === qi ? { ...pq, options: e.target.value.split("\n") } : pq,
                                ),
                              )
                            }
                            placeholder={"A. Option 1\nB. Option 2\nC. Option 3\nD. Option 4"}
                            rows={3}
                            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>
                    )}
                    {q.kind === "matching" && (
                      <input
                        value={q.correct_answer}
                        onChange={(e) =>
                          setManualQuestions((prev) =>
                            prev.map((pq, i) =>
                              i === qi ? { ...pq, correct_answer: e.target.value } : pq,
                            ),
                          )
                        }
                        placeholder="Correct pairs (e.g. 1-A, 2-C, 3-B)"
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setManualQuestions((prev) => [...prev, { ...EMPTY_MANUAL_Q }])}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-4 w-4" /> Add Question
              </button>
            </>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={saveQuiz}
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create worksheet"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!policyQuiz}
        onClose={() => setPolicyQuiz(null)}
        title={`Retake policy — ${policyQuiz?.title ?? ""}`}
      >
        <PolicyFields
          value={policyForm}
          onChange={(patch) => setPolicyForm((f) => ({ ...f, ...patch }))}
        />
        <button
          onClick={savePolicy}
          disabled={saving}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save policy"}
        </button>
      </Modal>

      <Modal
        open={!!editQuiz}
        onClose={() => setEditQuiz(null)}
        title={`Edit worksheet — ${editQuiz?.title ?? ""}`}
        wide
      >
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
          <PolicyFields
            value={editQuizForm}
            onChange={(patch) => setEditQuizForm((f) => ({ ...f, ...patch }))}
          />
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
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Release scores to students</span>
              <input
                type="checkbox"
                checked={!!editQuizForm.score_released}
                onChange={(e) =>
                  setEditQuizForm((f) => ({ ...f, score_released: e.target.checked }))
                }
                className="h-4 w-4 rounded border-input"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Release answer key</span>
              <input
                type="checkbox"
                checked={!!editQuizForm.answer_key_released}
                onChange={(e) =>
                  setEditQuizForm((f) => ({ ...f, answer_key_released: e.target.checked }))
                }
                className="h-4 w-4 rounded border-input"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              When unchecked, students see “Awaiting teacher release”.
            </p>
          </div>
          {editQuiz && (
            <MaterialManager
              target="quiz"
              id={editQuiz.id}
              courseId={editQuiz.course_id}
              attachments={editQuiz.attachments ?? []}
            />
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

      <Modal
        open={!!editAssign}
        onClose={() => setEditAssign(null)}
        title={`Edit assignment — ${editAssign?.title ?? ""}`}
      >
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
              onChange={(e) =>
                setEditAssignForm((f) => ({
                  ...f,
                  component_type: e.target.value as Assignment["component_type"],
                }))
              }
              aria-label="Grading component"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(COMPONENT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {editAssign && (
            <MaterialManager
              target="assignment"
              id={editAssign.id}
              courseId={editAssign.course_id}
              attachments={editAssign.attachments ?? []}
            />
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

      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={`Remove ${removeTarget?.kind === "quiz" ? "worksheet" : "assignment"}`}
      >
        <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            <span className="font-semibold">{removeTarget?.title}</span> — archiving hides it from
            students while keeping every score, attempt, and audit record. Permanent deletion also
            erases attached files and cannot be undone.
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

      <Modal
        open={!!rosterQuiz}
        onClose={() => setRosterQuiz(null)}
        title={`Attempts — ${rosterQuiz?.title ?? ""}`}
        wide
      >
        {rosterQuiz && <AttemptRoster quizId={rosterQuiz.id} />}
      </Modal>
    </AppShell>
  );
}

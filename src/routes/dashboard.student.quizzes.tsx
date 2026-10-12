import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Timer,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { setAssessmentMode } from "@/lib/assessment-mode";
import { useExamLock } from "@/hooks/useExamLock";
import { ArduinoLab } from "@/components/arduino-lab";
import {
  useAntiCheat,
  integrityLabel,
  isSevereIntegrityEvent,
  INTEGRITY_EVENT_TYPES,
} from "@/lib/anti-cheat";
import {
  getQuiz,
  enrollmentsForStudent,
  fmtDateTime,
  listCourses,
  listQuizzes,
  materialHref,
  myQuizSummaries,
  submitQuizAnswers,
  type QuizQuestionPublic,
  type SubmitQuizResult,
} from "@/lib/lms";
import {
  AppShell,
  Badge,
  EmptyState,
  Modal,
  MotionCard,
  STUDENT_NAV,
  courseStyle,
  useProfile,
} from "@/components/lms";
import { cn } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui-elements";

export const Route = createFileRoute("/dashboard/student/quizzes")({
  head: () => ({
    meta: [
      { title: "Worksheets | MIOW - Integrated Developmental School" },
      {
        name: "description",
        content: "Take timed worksheets and exams — scores appear after teacher release.",
      },
      { property: "og:title", content: "Worksheets | MIOW - Integrated Developmental School" },
      {
        property: "og:description",
        content: "Take timed worksheets and exams — scores appear after teacher release.",
      },
    ],
  }),
  component: QuizzesPage,
});

type QuizSuccess = Extract<SubmitQuizResult, { ok: true }>;

/**
 * Stable idempotency key for a single worksheet attempt. Retrying a submit
 * (double-click, flaky network) reuses it so the server replays the stored
 * result instead of recording a duplicate attempt.
 */
function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** "Attempt 2 of 3", "Attempt 2", or "Unlimited attempts". */
function attemptLabel(used: number, allowed: number | null, next = false): string {
  const n = next ? used + 1 : used;
  if (allowed == null) return next ? `Attempt ${n} · unlimited` : `${used} used · unlimited`;
  return `Attempt ${n} of ${allowed}`;
}

function QuizzesPage() {
  const profile = useProfile(["student"]);
  const queryClient = useQueryClient();
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
    enabled: !!profile,
  });
  const { data: quizzes } = useQuery({
    queryKey: ["quizzes"],
    queryFn: listQuizzes,
    enabled: !!profile,
  });
  const { data: summaries } = useQuery({
    queryKey: ["quiz-summaries"],
    queryFn: myQuizSummaries,
    enabled: !!profile,
  });
  const { data: enrolledCourseIds } = useQuery({
    queryKey: ["enrollments", "student", profile?.id],
    queryFn: () => enrollmentsForStudent(profile!.id),
    enabled: !!profile?.id,
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  // Collapsible Virtual Arduino Lab panel for problem-solving (lab_task) items.
  const [labOpen, setLabOpen] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<QuizSuccess | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Persist timer + answers per quiz so closing/reopening or accidental reload doesn't reset progress
  const getStoredTimer = (id: string): number | null => {
    try {
      const v = localStorage.getItem(`miow_quiz_timer_${id}`);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  };
  const setStoredTimer = (id: string, sec: number) => {
    try {
      localStorage.setItem(`miow_quiz_timer_${id}`, String(sec));
    } catch {
      /* ignore storage quota or access error */
    }
  };
  const clearStoredProgress = (id: string) => {
    try {
      localStorage.removeItem(`miow_quiz_timer_${id}`);
      localStorage.removeItem(`miow_quiz_answers_${id}`);
    } catch {
      /* ignore storage access error */
    }
  };
  const getStoredAnswers = (id: string): Record<string, string> => {
    try {
      const v = localStorage.getItem(`miow_quiz_answers_${id}`);
      return v ? JSON.parse(v) : {};
    } catch {
      return {};
    }
  };
  const setStoredAnswers = (id: string, a: Record<string, string>) => {
    try {
      localStorage.setItem(`miow_quiz_answers_${id}`, JSON.stringify(a));
    } catch {
      /* ignore storage quota or access error */
    }
  };

  const savedTimerRef = useRef<Map<string, number>>(new Map());
  const savedAnswersRef = useRef<Map<string, Record<string, string>>>(new Map());
  // Persist the sampled question set for the in-progress attempt so reopening a
  // worksheet keeps the SAME questions (answers stay mapped). Cleared on submit,
  // so the next attempt (retake) fetches a fresh, non-overlapping bank subset.
  const savedAttemptRef = useRef<
    Map<string, { questions: QuizQuestionPublic[]; duration: number; submissionId: string }>
  >(new Map());

  const activeQuiz = useMemo(
    () => (quizzes ?? []).find((q) => q.id === activeId),
    [quizzes, activeId],
  );
  const summaryByQuiz = useMemo(
    () => new Map((summaries ?? []).map((s) => [s.quiz_id, s])),
    [summaries],
  );

  // Assessment integrity: hide the ClassMate Assistant while a worksheet is
  // actively being taken (restored on the review screen and on unmount).
  const taking = !!activeId && !result;
  useEffect(() => {
    setAssessmentMode(taking);
    return () => setAssessmentMode(false);
  }, [taking]);

  // Anti-cheat: detect tab switches / devtools / paste during active assessment
  const { tabSwitches, switchCount, counts, showFlash, flashType } = useAntiCheat(taking);
  // Hard lock while taking: fullscreen + input blocking (installed PWA kiosk).
  const examLock = useExamLock(taking);

  // Maximum violations auto-submission rule:
  // If severe tab switches or integrity violations hit 3 strikes, auto-submit the exam.
  const MAX_ALLOWED_VIOLATIONS = 3;
  useEffect(() => {
    if (taking && switchCount >= MAX_ALLOWED_VIOLATIONS && !submittedRef.current) {
      toast.error(
        `Security threshold exceeded (${switchCount}/${MAX_ALLOWED_VIOLATIONS} violations). Auto-submitting worksheet...`,
        { duration: 5000 },
      );
      finishRef.current?.();
    }
  }, [taking, switchCount]);

  // Resume or start attempt: restore saved timer/answers if the student
  // closed and reopened the same worksheet within this session.
  const beginAttempt = async (id: string) => {
    // Reuse the in-progress attempt's sampled questions when present so a
    // reopen doesn't swap the question set (and lose already-answered items).
    let attempt = savedAttemptRef.current.get(id);
    if (!attempt) {
      const { quiz, questions } = await getQuiz(id);
      attempt = {
        questions,
        duration: quiz.duration_minutes * 60,
        submissionId: newSubmissionId(),
      };
      savedAttemptRef.current.set(id, attempt);
    }
    setQuestions(attempt.questions);
    setResult(null);
    // Restore saved answers if they exist for this quiz
    const localAnswers = getStoredAnswers(id);
    const inMemAnswers = savedAnswersRef.current.get(id);
    const restoredAnswers =
      Object.keys(localAnswers).length > 0 ? localAnswers : (inMemAnswers ?? {});
    setAnswers(restoredAnswers);
    setIdx(0);
    // Restore saved timer or start fresh
    const localTimer = getStoredTimer(id);
    const saved = savedTimerRef.current.get(id);
    const activeSec = localTimer ?? saved;
    if (activeSec != null && activeSec > 0) {
      setSecondsLeft(activeSec);
    } else {
      setSecondsLeft(attempt.duration);
    }
  };

  useEffect(() => {
    if (activeId) {
      submittedRef.current = false;
      void beginAttempt(activeId);
    }
  }, [activeId]);

  useEffect(() => {
    if (!activeId || result || secondsLeft <= 0) return;
    // Persist remaining time so closing/reopening or reload preserves it
    savedTimerRef.current.set(activeId, secondsLeft);
    setStoredTimer(activeId, secondsLeft);
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [activeId, secondsLeft, result]);

  // Persist answers per quiz so closing/reopening preserves progress
  useEffect(() => {
    if (activeId && Object.keys(answers).length > 0) {
      savedAnswersRef.current.set(activeId, answers);
      setStoredAnswers(activeId, answers);
    }
  }, [activeId, answers]);

  // Clear saved progress on successful submission
  useEffect(() => {
    if (result?.ok && activeId) {
      savedTimerRef.current.delete(activeId);
      savedAnswersRef.current.delete(activeId);
      savedAttemptRef.current.delete(activeId);
      clearStoredProgress(activeId);
    }
  }, [result, activeId]);

  const finishRef = useRef<(() => Promise<void>) | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (secondsLeft === 0 && finishRef.current) finishRef.current();
  }, [secondsLeft]);

  const isLoading = !courses || !quizzes || !summaries || !enrolledCourseIds;

  if (!profile) return null;

  if (isLoading)
    return (
      <AppShell nav={STUDENT_NAV} profile={profile} subtitle="Student Portal">
        <LoadingSkeleton />
      </AppShell>
    );

  // Enrollment is the source of truth (mixed college sections); grade level is a
  // fallback so a student with no enrollment rows still sees their year's work.
  const enrolled = new Set(enrolledCourseIds ?? []);
  const myCourses = (courses ?? []).filter(
    (c) => enrolled.has(c.id) || c.grade_level === profile.grade_level,
  );
  const courseIds = new Set(myCourses.map((c) => c.id));
  const myQuizzes = (quizzes ?? []).filter((q) => courseIds.has(q.course_id));

  const finish = async () => {
    if (!activeId || result || !questions.length || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      // Answers are scored server-side; the server enforces the retake policy
      // before recording the attempt. Pass question_ids for question bank scoring.
      const res = await submitQuizAnswers(
        activeId,
        answers,
        questions.map((q) => q.id),
        tabSwitches,
        savedAttemptRef.current.get(activeId)?.submissionId,
      );
      await queryClient.invalidateQueries({ queryKey: ["quiz-summaries"] });
      if (!res.ok) {
        toast.error(
          res.reason === "retakes_disabled"
            ? "Retakes are not permitted for this worksheet."
            : "Maximum attempts exceeded for this worksheet.",
        );
        setActiveId(null);
        return;
      }
      setResult(res);
    } catch {
      // Network drop / transient error: allow the student to retry instead of
      // leaving them stuck on a permanently-disabled submit button.
      submittedRef.current = false;
      toast.error("Could not score the worksheet — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  finishRef.current = finish;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const current = questions[idx];
  const answeredCount = Object.keys(answers).length;

  return (
    <AppShell nav={STUDENT_NAV} profile={profile} subtitle="Student Portal">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Worksheets</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Timed worksheets, drills, and exams — scores appear after your teacher releases them.
      </p>

      {myQuizzes.length === 0 ? (
        <EmptyState title="No worksheets available yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {myQuizzes.map((q, i) => {
            const course = myCourses.find((c) => c.id === q.course_id);
            const st = courseStyle(course?.color ?? "indigo");
            const s = summaryByQuiz.get(q.id);
            const used = s?.attempts_used ?? 0;
            const isClosed = q.closes_at ? new Date(q.closes_at).getTime() < Date.now() : false;
            const canTake = !isClosed && (!s || s.can_retake);
            return (
              <MotionCard key={q.id} delay={Math.min(i * 0.05, 0.3)} className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", st.soft)}>
                    {course?.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isClosed ? (
                      <Badge tone="red">Closed</Badge>
                    ) : q.closes_at ? (
                      <Badge tone="sky">Closes {fmtDateTime(q.closes_at)}</Badge>
                    ) : null}
                    {used > 0 && (
                      <Badge tone={canTake ? "indigo" : "slate"}>
                        {attemptLabel(used, s?.attempts_allowed ?? null)}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="mt-2 font-semibold">{q.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {q.duration_minutes} minutes
                  {used > 0 && s?.effective_score != null && (
                    <>
                      {" · "}Standing score: {s.effective_score}/{s.effective_total}
                    </>
                  )}
                </p>
                {(q.attachments ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.attachments!.map((a) => (
                      <a
                        key={a.path}
                        href={materialHref(a)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <Paperclip className="h-3 w-3" />
                        {a.name}
                      </a>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    // Fullscreen needs a user gesture — request it here so the
                    // exam opens in kiosk mode before the first render.
                    examLock.lock();
                    setActiveId(q.id);
                  }}
                  disabled={!canTake}
                  title={
                    isClosed
                      ? "The deadline for this worksheet has passed."
                      : !canTake
                        ? "Maximum attempts reached. Contact your teacher to request a retake."
                        : undefined
                  }
                  className={cn(
                    "mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold",
                    canTake
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "cursor-not-allowed bg-muted text-muted-foreground",
                  )}
                >
                  {used > 0 && canTake && <RotateCcw className="h-3.5 w-3.5" />}
                  {isClosed
                    ? "Submission closed"
                    : used === 0
                      ? "Start worksheet"
                      : canTake
                        ? `Retake — ${attemptLabel(used, s?.attempts_allowed ?? null, true)}`
                        : "Max attempts reached"}
                </button>
              </MotionCard>
            );
          })}
        </div>
      )}

      <Modal
        open={!!activeId}
        onClose={() => setActiveId(null)}
        title={activeQuiz?.title ?? "Worksheet"}
        wide
        allowClose={!taking}
      >
        {result ? (
          // Teacher-gated release: server gates score/answer_key; client mirrors via result.score_released
          result.score == null ||
          (result as unknown as { score_released?: boolean })?.score_released === false ? (
            <div className="flex flex-col items-center py-8 text-center">
              <ShieldCheck className="h-14 w-14 text-emerald-500" />
              <p className="mt-3 text-lg font-bold">Worksheet Submitted & Hardlocked</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your answers have been securely recorded. Your teacher will release your score soon.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Attempt {result.attempts_used} of {result.attempts_allowed ?? "∞"} recorded — score
                hidden until release.
              </p>
              <div className="mt-5 flex flex-col gap-2 w-full">
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-800 dark:text-amber-200">
                  🔒 Session Locked: Please wait for your teacher or proctor's instructions before leaving your station.
                </p>
                <button
                  onClick={() => setActiveId(null)}
                  className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col items-center py-4 text-center">
                <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                <p className="mt-3 font-display text-3xl font-bold">
                  {result.score} / {result.total}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {Math.round((result.score / Math.max(1, result.total)) * 100)}% —{" "}
                  {result.score / Math.max(1, result.total) >= 0.75
                    ? "Great job!"
                    : "Review the material and try again in class."}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Badge tone="indigo">
                    {attemptLabel(result.attempts_used, result.attempts_allowed)}
                  </Badge>
                  {result.effective_score !== result.score && (
                    <Badge tone="green">
                      Gradebook score: {result.effective_score}/{result.total} (
                      {result.retake_score_policy === "highest_score"
                        ? "highest kept"
                        : result.retake_score_policy === "average_score"
                          ? "average of attempts"
                          : "latest attempt"}
                      )
                    </Badge>
                  )}
                </div>
              </div>

              {/* Per-question review */}
              <div className="mt-2 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Review
                </p>
                {result.results.map((r, i) => (
                  <div key={r.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-start gap-2">
                      {r.correct ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      )}
                      <p className="text-sm font-semibold">
                        {i + 1}. {r.question}
                      </p>
                    </div>
                    {r.image_url && (
                      <img
                        src={r.image_url}
                        alt="Question illustration"
                        className="mt-2 max-h-40 rounded-lg border border-border object-contain"
                      />
                    )}
                    {r.options.length === 0 ? (
                      <div className="mt-2 space-y-1.5 text-xs">
                        <p className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground">
                          Your answer: {r.chosen?.trim() ? r.chosen : "Not answered"}
                        </p>
                        <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                          {r.correct_answer?.startsWith("Rubric:")
                            ? // Strip the auto-grader's "| Keywords: ..." block from the review display.
                              `Rubric: ${r.correct_answer.slice("Rubric:".length).split("| Keywords:")[0]!.trim()}`
                            : `Answer: ${r.correct_answer?.split("||")[0]}`}
                        </p>
                        {r.correct_answer?.startsWith("Rubric:") && !r.correct && (
                          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-rose-700 dark:text-rose-300">
                            Auto-graded: answers need at least 5 real words and must cover the
                            rubric's key concepts — gibberish or one-word replies fail
                            automatically.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        {r.options.map((opt) => {
                          const isCorrect = opt === r.correct_answer;
                          const isChosen = opt === r.chosen;
                          return (
                            <p
                              key={opt}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-xs",
                                isCorrect
                                  ? "border-emerald-500/50 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300"
                                  : isChosen
                                    ? "border-rose-500/50 bg-rose-500/10 font-semibold text-rose-700 dark:text-rose-300"
                                    : "border-border text-muted-foreground",
                              )}
                            >
                              {opt}
                              {isCorrect && " ✓"}
                              {isChosen && !isCorrect && " — your answer"}
                            </p>
                          );
                        })}
                      </div>
                    )}
                    {!r.chosen && r.options.length > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">Not answered</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Retake actions */}
              <div className="mt-5 flex flex-col gap-2">
                {result.can_retake ? (
                  <button
                    onClick={() => {
                      examLock.lock();
                      if (activeId) void beginAttempt(activeId);
                    }}
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retake Worksheet —{" "}
                    {attemptLabel(result.attempts_used, result.attempts_allowed, true)}
                  </button>
                ) : (
                  <p className="rounded-xl border border-border/60 bg-muted/60 px-4 py-3 text-center text-xs text-muted-foreground">
                    Maximum attempts reached. Contact your teacher to request a retake.
                  </p>
                )}
                <button
                  onClick={() => setActiveId(null)}
                  className={cn(
                    "h-11 w-full rounded-xl text-sm font-semibold",
                    result.can_retake
                      ? "border border-border hover:bg-muted"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  Done
                </button>
              </div>
            </div>
          )
        ) : (
          <>
            {/* Hard lock: fullscreen was exited mid-exam — block the paper
                until the student returns to fullscreen (tap = new gesture). */}
            {examLock.lockLost && (
              <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/95 p-8 text-center backdrop-blur">
                <ShieldCheck className="h-12 w-12 text-primary" />
                <p className="text-xl font-bold">Exam lockdown active</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  This assessment runs in secure fullscreen mode. You must return to fullscreen to keep answering — your exam timer is still running.
                </p>
                <button
                  type="button"
                  onClick={() => examLock.lock()}
                  className="flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-lift"
                >
                  Return to fullscreen
                </button>
              </div>
            )}
            <div className="mb-2 flex items-center justify-between rounded-xl bg-muted px-4 py-2.5">
              <Badge tone="indigo">{questions.length} questions</Badge>
              <p
                className={cn(
                  "flex items-center gap-1.5 font-display text-lg font-bold tabular-nums",
                  secondsLeft < 60 && "text-rose-600",
                )}
              >
                <Timer className="h-4 w-4" /> {mm}:{ss}
              </p>
            </div>
            <p className="mb-4 flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              Assessment integrity: the ClassMate Assistant is disabled until you submit.
            </p>

            {/* Anti-cheat: integrity warning */}
            {switchCount > 0 && (
              <div
                className={cn(
                  "mb-4 rounded-xl border px-3 py-2 text-xs transition-colors",
                  showFlash
                    ? flashType && isSevereIntegrityEvent(flashType)
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400",
                )}
              >
                <p className="flex items-center gap-1.5 font-semibold">
                  <EyeOff className="h-3.5 w-3.5 shrink-0" />
                  {showFlash && flashType
                    ? `${integrityLabel(flashType)} recorded`
                    : "Integrity events are being logged"}
                  <span className="ml-auto font-bold tabular-nums">{switchCount} total</span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {INTEGRITY_EVENT_TYPES.filter((t) => counts[t] > 0).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-medium"
                    >
                      {integrityLabel(t)} · {counts[t]}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] opacity-80">
                  Keep this tab focused while answering — repeated events are shared with your
                  teacher.
                </p>
              </div>
            )}

            {/* Stepper dots */}
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setIdx(i)}
                  aria-label={`Go to question ${i + 1}`}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                    i === idx
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                      : answers[q.id]
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">
                {answeredCount}/{questions.length} answered
              </span>
            </div>

            {current && (
              <div>
                <p className="mb-3 text-sm font-semibold">
                  {idx + 1}. {current.question}
                </p>
                {current.image_url && (
                  <img
                    src={current.image_url}
                    alt="Question illustration"
                    className="mx-auto mb-3 max-h-56 rounded-lg border border-border bg-background object-contain"
                  />
                )}
                {current.options.length === 0 ? (
                  // Fill-in-the-blank and essay items have no options — free text.
                  <textarea
                    value={answers[current.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [current.id]: e.target.value }))}
                    placeholder={
                      current.lab_task
                        ? "Type or paste your final code / circuit description here…"
                        : "Type your answer here…"
                    }
                    rows={current.lab_task ? 8 : 3}
                    className={cn(
                      "w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring",
                      current.lab_task && "font-mono",
                    )}
                  />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {current.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setAnswers((a) => ({ ...a, [current.id]: opt }))}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                          answers[current.id] === opt
                            ? "border-primary bg-primary/10 font-semibold"
                            : "border-border hover:border-primary/40 hover:bg-muted",
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {current.lab_task && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-primary/30">
                    <button
                      type="button"
                      onClick={() => setLabOpen((o) => !o)}
                      className="flex w-full items-center justify-between gap-2 bg-primary/5 px-4 py-3 text-left text-sm font-semibold hover:bg-primary/10"
                    >
                      <span>🧪 Virtual Arduino Lab — build &amp; test your solution here</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          labOpen && "rotate-180",
                        )}
                      />
                    </button>
                    {labOpen && (
                      <div className="max-h-[70vh] overflow-y-auto border-t border-border p-3">
                        <ArduinoLab />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* File upload for quiz submissions is not yet implemented — see submission_files table */}

            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="flex h-11 items-center gap-1 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              {idx < questions.length - 1 ? (
                <button
                  onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
                  className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={finish}
                  disabled={submitting}
                  className="h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Submitting…"
                    : `Submit answers (${answeredCount}/${questions.length})`}
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
    </AppShell>
  );
}

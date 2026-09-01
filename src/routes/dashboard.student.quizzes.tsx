import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
  Timer,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { setAssessmentMode } from "@/lib/assessment-mode";
import {
  formatFileSize,
  getQuiz,
  listCourses,
  listQuizzes,
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

export const Route = createFileRoute("/dashboard/student/quizzes")({
  head: () => ({
    meta: [
      { title: "Worksheets | MIOW - MSU-IIT IDS Online Workspace" },
      {
        name: "description",
        content: "Take timed worksheets and exams — scores appear after teacher release.",
      },
      { property: "og:title", content: "Worksheets | MIOW - MSU-IIT IDS Online Workspace" },
      {
        property: "og:description",
        content: "Take timed worksheets and exams — scores appear after teacher release.",
      },
    ],
  }),
  component: QuizzesPage,
});

type QuizSuccess = Extract<SubmitQuizResult, { ok: true }>;

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

  const [activeId, setActiveId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<QuizSuccess | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

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

  // Fresh attempt state: clear inputs while the server preserves prior
  // attempts in quiz_attempts history.
  const beginAttempt = async (id: string) => {
    const { quiz, questions } = await getQuiz(id);
    setQuestions(questions);
    setAnswers({});
    setResult(null);
    setIdx(0);
    setUploadFile(null);
    setSecondsLeft(quiz.duration_minutes * 60);
  };

  useEffect(() => {
    if (activeId) void beginAttempt(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (!activeId || result || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [activeId, secondsLeft, result]);

  useEffect(() => {
    if (activeId && secondsLeft === 0 && !result && questions.length) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (!profile) return null;

  const myCourses = (courses ?? []).filter((c) => c.grade_level === profile.grade_level);
  const courseIds = new Set(myCourses.map((c) => c.id));
  const myQuizzes = (quizzes ?? []).filter((q) => courseIds.has(q.course_id));

  const finish = async () => {
    if (!activeId || result || !questions.length) return;
    try {
      // Answers are scored server-side; the server enforces the retake policy
      // before recording the attempt.
      const res = await submitQuizAnswers(activeId, answers);
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
      toast.error("Could not score the worksheet — please try again.");
    }
  };

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
            const canTake = !s || s.can_retake;
            return (
              <MotionCard key={q.id} delay={Math.min(i * 0.05, 0.3)} className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", st.soft)}>
                    {course?.code}
                  </span>
                  {used > 0 && (
                    <Badge tone={canTake ? "indigo" : "slate"}>
                      {attemptLabel(used, s?.attempts_allowed ?? null)}
                    </Badge>
                  )}
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
                <button
                  onClick={() => setActiveId(q.id)}
                  disabled={!canTake}
                  title={
                    !canTake
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
                  {used === 0
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
      >
        {result ? (
          // Teacher-gated release: server gates score/answer_key; client mirrors via result.score_released
          result.score == null ||
          (result as unknown as { score_released?: boolean })?.score_released === false ? (
            <div className="flex flex-col items-center py-8 text-center">
              <ShieldCheck className="h-12 w-12 text-amber-500" />
              <p className="mt-3 text-base font-semibold">Awaiting teacher release</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your worksheet has been submitted. Your teacher will release your score soon.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Attempt {result.attempts_used} of {result.attempts_allowed ?? "∞"} recorded — score
                hidden until release.
              </p>
              <div className="mt-4 flex flex-col gap-2 w-full">
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-800 dark:text-amber-200">
                  Awaiting teacher release — submitted. You&apos;ll see your score and review once
                  your teacher releases it.
                </p>
                <button
                  onClick={() => setActiveId(null)}
                  className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Done
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
                    {r.options.length === 0 ? (
                      <div className="mt-2 space-y-1.5 text-xs">
                        <p className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground">
                          Your answer: {r.chosen?.trim() ? r.chosen : "Not answered"}
                        </p>
                        <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                          {r.correct_answer.startsWith("Rubric:")
                            ? // Strip the auto-grader's "| Keywords: ..." block from the review display.
                              `Rubric: ${r.correct_answer.slice("Rubric:".length).split("| Keywords:")[0]!.trim()}`
                            : `Answer: ${r.correct_answer.split("||")[0]}`}
                        </p>
                        {r.correct_answer.startsWith("Rubric:") && !r.correct && (
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
                    onClick={() => activeId && void beginAttempt(activeId)}
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
                {current.options.length === 0 ? (
                  // Fill-in-the-blank and essay items have no options — free text.
                  <textarea
                    value={answers[current.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [current.id]: e.target.value }))}
                    placeholder="Type your answer here…"
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
              </div>
            )}

            {/* Task 24: worksheet file upload placeholder (25MB each, not yet wired to submission_files) */}
            <div className="mt-5 rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold">Attach supporting file (optional)</p>
              <p className="text-[11px] text-muted-foreground">
                Up to 25MB each — stored via submission_files (coming soon).
              </p>
              <input
                type="file"
                aria-label="Worksheet supporting file"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
              />
              {uploadFile && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {uploadFile.name} · {formatFileSize(uploadFile.size)}
                </p>
              )}
            </div>

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
                  className="h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:opacity-90"
                >
                  Submit answers ({answeredCount}/{questions.length})
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
    </AppShell>
  );
}

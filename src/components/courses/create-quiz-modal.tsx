import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudUpload, FileText, Plus, Sparkles, Trash2, X } from "lucide-react";
import { type Course, createQuizWithQuestions } from "@/lib/lms";
import { extractTextFromFile, isWorksheetAcceptedFile } from "@/lib/extract-text";
import { parseWorksheet } from "@/lib/worksheet-parser";
import { openWorksheetChat, WORKSHEET_CONTENT_EVENT } from "@/lib/worksheet-context";
import { Modal } from "@/components/lms";
import { PolicyFields } from "@/components/courses/policy-fields";
import {
  EMPTY_POLICY,
  EMPTY_MANUAL_Q,
  COURSE_MATERIAL_MAX_BYTES,
  policyPayload,
  type QuizMode,
  type ManualQuestion,
} from "@/components/courses/constants";
import { cn } from "@/lib/utils";

interface CreateQuizModalProps {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  onSaved: () => void;
}

export function CreateQuizModal({ open, onClose, courses, onSaved }: CreateQuizModalProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [quizForm, setQuizForm] = useState({
    ...EMPTY_POLICY,
    course_id: "",
    title: "",
    duration_minutes: "15",
    question_count: "0",
    questions: "",
  });
  const [quizMode, setQuizMode] = useState<QuizMode>("classmate");
  const [manualQuestions, setManualQuestions] = useState<ManualQuestion[]>([]);
  const [quizFileDrag, setQuizFileDrag] = useState(false);
  const [quizFileName, setQuizFileName] = useState<string | null>(null);

  // Auto-fill textarea when the chat widget pushes generated worksheet content.
  useEffect(() => {
    const onContent = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === "string" && text.trim()) {
        setQuizForm((f) => ({ ...f, questions: text.trim() }));
        setQuizMode("classmate");
      }
    };
    window.addEventListener(WORKSHEET_CONTENT_EVENT, onContent);
    return () => window.removeEventListener(WORKSHEET_CONTENT_EVENT, onContent);
  }, []);

  const handleClose = () => {
    onClose();
    setQuizMode("classmate");
    setManualQuestions([]);
    setQuizFileName(null);
  };

  const handleFileLoad = (file: File) => {
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
          const course = courses.find((c) => c.id === quizForm.course_id);
          if (course && quizForm.title.trim()) {
            openWorksheetChat({
              course: `${course.code} — ${course.title}`,
              title: quizForm.title.trim(),
              sourceMaterial: text,
              autoMessage: `Generate ${quizForm.question_count || 10} parser-ready multiple-choice and fill-in-the-blank questions based on the uploaded material for "${quizForm.title.trim()}". Follow the strict 4-section format with Answer Key.`,
            });
            toast.success("File loaded — ClassMate is generating questions now.");
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
  };

  const saveQuiz = async () => {
    if (!quizForm.course_id || !quizForm.title) {
      toast.error("Course and title are required.");
      return;
    }

    let questions: Array<{ question: string; options: string[]; correct_answer: string }>;

    if (quizMode === "manual") {
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
      const parsed = parseWorksheet(quizForm.questions);
      if (!parsed.questions.length) {
        toast.error(
          "No valid questions found — paste the four-section worksheet (with its Answer Key), upload a file, or use 'Generate with ClassMate'.",
        );
        return;
      }
      if (parsed.dropped > 0) {
        const detail = parsed.skipped?.length
          ? `\n${parsed.skipped.map((s) => `Q${s.num}: ${s.reason}`).join("; ")}`
          : "";
        toast.warning(
          `${parsed.dropped} item${parsed.dropped > 1 ? "s were" : " was"} skipped${detail ? ` — ${detail.slice(2)}` : ""}`,
          { duration: 8000 },
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
      onSaved();
      setQuizForm({
        ...EMPTY_POLICY,
        course_id: "",
        title: "",
        duration_minutes: "15",
        question_count: "0",
        questions: "",
      });
      setManualQuestions([]);
      setQuizMode("classmate");
      setQuizFileName(null);
      onClose();
    } catch {
      toast.error("Could not create worksheet.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create worksheet" wide>
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={quizForm.course_id}
            onChange={(e) => setQuizForm((f) => ({ ...f, course_id: e.target.value }))}
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-2"
          >
            <option value="">Select course *</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Duration (min)</span>
            <input
              value={quizForm.duration_minutes}
              onChange={(e) => setQuizForm((f) => ({ ...f, duration_minutes: e.target.value }))}
              placeholder="15"
              inputMode="numeric"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
        <input
          value={quizForm.title}
          onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Worksheet title *"
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Questions per student
            </span>
            <input
              value={quizForm.question_count}
              onChange={(e) => setQuizForm((f) => ({ ...f, question_count: e.target.value }))}
              placeholder="0"
              inputMode="numeric"
              className="h-9 w-20 rounded-lg border border-input bg-background px-3 text-sm text-center outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <span className="text-[11px] text-muted-foreground">
            0 = all questions · e.g. 10 = random 10 per student
          </span>
        </div>
        <PolicyFields
          value={quizForm}
          onChange={(patch) => setQuizForm((f) => ({ ...f, ...patch }))}
        />

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

        {quizMode === "classmate" && (
          <>
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
                  handleFileLoad(file);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-5 text-center transition",
                  quizFileDrag
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                    : "border-border hover:border-primary/50 hover:bg-muted/60",
                )}
              >
                <CloudUpload
                  className={cn("h-5 w-5", quizFileDrag ? "text-primary" : "text-muted-foreground")}
                />
                <p className="text-xs font-semibold">Drag & drop a file here, or click to browse</p>
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
                    handleFileLoad(file);
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
                const course = courses.find((c) => c.id === quizForm.course_id);
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
                        prev.map((pq, i) => (i === qi ? { ...pq, question: e.target.value } : pq)),
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
  );
}

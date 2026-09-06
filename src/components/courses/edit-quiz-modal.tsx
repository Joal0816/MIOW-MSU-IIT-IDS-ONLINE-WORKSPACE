import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type Quiz, updateQuiz } from "@/lib/lms";
import { parseWorksheet } from "@/lib/worksheet-parser";
import { Modal } from "@/components/lms";
import { PolicyFields } from "@/components/courses/policy-fields";
import { MaterialManager } from "@/components/courses/material-manager";
import { EMPTY_POLICY, policyPayload } from "@/components/courses/constants";

interface EditQuizModalProps {
  quiz: Quiz | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditQuizModal({ quiz, onClose, onSaved }: EditQuizModalProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editQuizForm, setEditQuizForm] = useState({
    ...EMPTY_POLICY,
    title: "",
    duration_minutes: "15",
    question_count: "0",
    questions: "",
    score_released: false,
    answer_key_released: false,
  });

  const initForm = (q: Quiz) => {
    setEditQuizForm({
      allow_retake: q.allow_retake,
      unlimited: q.max_attempts === 0,
      max_attempts: String(q.max_attempts || 1),
      retake_score_policy: q.retake_score_policy,
      title: q.title,
      duration_minutes: String(q.duration_minutes),
      question_count: String(q.question_count ?? 0),
      questions: "",
      score_released: !!q.score_released,
      answer_key_released: !!q.answer_key_released,
    });
  };

  useEffect(() => {
    if (quiz) initForm(quiz);
  }, [quiz]);

  const saveQuizEdit = async () => {
    if (!quiz) return;
    if (!editQuizForm.title.trim()) {
      toast.error("Title is required.");
      return;
    }
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
        quiz.id,
        {
          title: editQuizForm.title.trim(),
          duration_minutes: Math.max(1, parseInt(editQuizForm.duration_minutes) || 15),
          question_count: parseInt(editQuizForm.question_count) || 0,
          ...policyPayload(editQuizForm),
          score_released: !!editQuizForm.score_released,
          answer_key_released: !!editQuizForm.answer_key_released,
        },
        questions,
      );
      toast.success(questions ? "Worksheet and questions updated." : "Worksheet updated.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the worksheet.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!quiz} onClose={onClose} title={`Edit worksheet — ${quiz?.title ?? ""}`} wide>
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
              onChange={(e) => setEditQuizForm((f) => ({ ...f, score_released: e.target.checked }))}
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
            When unchecked, students see "Awaiting teacher release".
          </p>
        </div>
        {quiz && (
          <MaterialManager
            target="quiz"
            id={quiz.id}
            courseId={quiz.course_id}
            attachments={quiz.attachments ?? []}
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
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eraser, RotateCcw } from "lucide-react";
import { listQuizAttempts, grantQuizRetake, resetQuizAttempts } from "@/lib/lms";
import { Badge, EmptyState } from "@/components/lms";

export function AttemptRoster({ quizId }: { quizId: string }) {
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
    if (
      !confirm(
        `Reset all attempts for ${name}? Their attempt history on this worksheet will be wiped.`,
      )
    )
      return;
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

  if (isLoading)
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading attempts…</p>;
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
              <span
                key={a.attempt_number}
                className="rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold"
              >
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

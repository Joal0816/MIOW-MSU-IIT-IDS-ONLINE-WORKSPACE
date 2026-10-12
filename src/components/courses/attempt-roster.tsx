import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eraser, Eye, EyeOff, Radio, RotateCcw, Search } from "lucide-react";
import { listQuizAttempts, grantQuizRetake, resetQuizAttempts } from "@/lib/lms";
import { Badge, EmptyState } from "@/components/lms";
import { switchSeverity } from "@/lib/anti-cheat";
import { cn } from "@/lib/utils";
import { AttemptDetail } from "@/components/courses/attempt-detail";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AttemptRoster({ quizId }: { quizId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["quiz-attempts", quizId],
    queryFn: () => listQuizAttempts(quizId),
    refetchInterval: liveMonitoring ? 5000 : false,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [liveMonitoring, setLiveMonitoring] = useState(true);
  const refresh = () => qc.invalidateQueries({ queryKey: ["quiz-attempts", quizId] });

  const sections = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.students.map((s) => s.section).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.students.filter((s) => {
      if (sectionFilter !== "all" && s.section !== sectionFilter) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.student_no ?? "").toLowerCase().includes(q) ||
        (s.section ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, sectionFilter]);

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

  if (isLoading || data === undefined)
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading attempts…</p>;
  if (data.students.length === 0) {
    return <EmptyState title="No attempts yet" sub="No student has submitted this worksheet." />;
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, student no.…"
            aria-label="Search students"
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="h-10 w-[140px] rounded-xl" aria-label="Filter by section">
            <SelectValue placeholder="All sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {sections.map((sec) => (
              <SelectItem key={sec} value={sec!}>
                {sec}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => setLiveMonitoring((m) => !m)}
          className={cn(
            "flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors",
            liveMonitoring
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          <Radio className={cn("h-3.5 w-3.5", liveMonitoring && "animate-pulse text-emerald-500")} />
          {liveMonitoring ? "Live Proctoring On (5s)" : "Live Off"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {data.students.length} student{data.students.length !== 1 ? "s" : ""}
      </p>

      {/* Student list */}
      {filtered.length === 0 ? (
        <EmptyState title="No matches" sub="Try a different search or filter." />
      ) : (
        filtered.map((s) => (
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
                {s.override_score != null && (
                  <Badge tone="amber">
                    Teacher: {s.override_score}/{s.override_total ?? "—"}
                  </Badge>
                )}
                {s.effective_score != null && (
                  <Badge tone="green">
                    Effective: {s.effective_score}/{s.effective_total}
                  </Badge>
                )}
                {s.extra_attempts > 0 && <Badge tone="amber">+{s.extra_attempts} granted</Badge>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.attempts.map((a) => {
                const switchCount = Array.isArray(a.tab_switches) ? a.tab_switches.length : 0;
                const severity = switchSeverity(switchCount);
                return (
                  <span
                    key={a.attempt_number}
                    className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold"
                  >
                    #{a.attempt_number}: {a.score}/{a.total}
                    {switchCount > 0 && (
                      <span
                        className={cn(
                          "rounded px-1 py-0.5 text-[10px]",
                          severity.bg,
                          severity.text,
                        )}
                      >
                        <EyeOff className="inline h-2.5 w-2.5" /> {switchCount}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setInspectId(inspectId === s.student_id ? null : s.student_id)}
                aria-label={`Inspect answers for ${s.full_name}`}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs font-semibold hover:bg-muted/70"
              >
                {inspectId === s.student_id ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" /> Hide answers
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Inspect answers
                  </>
                )}
              </button>
              <button
                onClick={() => grant(s.student_id)}
                disabled={busy === s.student_id}
                aria-label={`Grant extra retake to ${s.full_name}`}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Grant extra retake
              </button>
              <button
                onClick={() => reset(s.student_id, s.full_name)}
                disabled={busy === s.student_id}
                aria-label={`Reset attempts for ${s.full_name}`}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"
              >
                <Eraser className="h-3.5 w-3.5" /> Reset attempts
              </button>
            </div>

            {inspectId === s.student_id && (
              <AttemptDetail
                quizId={quizId}
                studentId={s.student_id}
                studentName={s.full_name}
                onChanged={refresh}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}

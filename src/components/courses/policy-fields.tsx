import { cn } from "@/lib/utils";
import { type RetakePolicy } from "@/lib/lms";
import { EMPTY_POLICY, POLICY_LABELS } from "./constants";

export function PolicyFields({
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

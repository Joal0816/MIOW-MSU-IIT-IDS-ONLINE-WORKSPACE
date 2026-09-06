import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type Course, createCourse, updateCourse } from "@/lib/lms";
import { Modal, Badge, courseStyle } from "@/components/lms";
import { COURSE_LEVELS, educationLevelOf, collegeYearOf, levelLabel } from "@/lib/course-levels";
import { CED_PROGRAMS, CED_DEPARTMENT_LABELS } from "@/lib/ced-programs";
import {
  EMPTY_COURSE,
  COLORS,
  DAYS,
  WIZARD_STEPS,
  type WizardStep,
} from "@/components/courses/constants";
import { cn } from "@/lib/utils";

interface CourseWizardModalProps {
  open: boolean;
  onClose: () => void;
  editing: Course | null;
  teachers: Array<{ id: string; full_name: string }>;
  isAdmin: boolean;
  onSaved: () => void;
}

export function CourseWizardModal({
  open,
  onClose,
  editing,
  teachers,
  isAdmin,
  onSaved,
}: CourseWizardModalProps) {
  const qc = useQueryClient();
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE);
  const [wizardStep, setWizardStep] = useState<WizardStep>("basic");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCourseForm({
        title: editing.title,
        code: editing.code,
        grade_level: String(editing.grade_level),
        teacher_id: editing.teacher_id ?? "",
        color: editing.color,
        days: editing.days_of_week ?? [],
        start_time: editing.start_time ? editing.start_time.slice(0, 5) : "",
        end_time: editing.end_time ? editing.end_time.slice(0, 5) : "",
        grace: String(editing.late_threshold_minutes ?? 10),
        strand: editing.strand ?? "",
        program: editing.program ?? "",
      });
    } else {
      setCourseForm(EMPTY_COURSE);
    }
    setWizardStep("basic");
  }, [open, editing]);

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
      onSaved();
      onClose();
    } catch {
      toast.error(editing ? "Could not update course." : "Could not create course.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.code}` : "New course"}
      wide
    >
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
                {teachers.map((t) => (
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
  );
}

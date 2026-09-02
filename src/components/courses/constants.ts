import type { RetakePolicy, Attachment } from "@/lib/lms";

export const COLORS = ["indigo", "emerald", "sky", "amber", "rose", "violet"];

export const DAYS: Array<{ code: string; label: string }> = [
  { code: "mon", label: "Mon" },
  { code: "tue", label: "Tue" },
  { code: "wed", label: "Wed" },
  { code: "thu", label: "Thu" },
  { code: "fri", label: "Fri" },
  { code: "sat", label: "Sat" },
  { code: "sun", label: "Sun" },
];

export const EMPTY_COURSE = {
  title: "",
  code: "",
  grade_level: "10",
  teacher_id: "",
  color: "indigo",
  days: [] as string[],
  start_time: "",
  end_time: "",
  grace: "10",
  strand: "",
  program: "",
};

export type WizardStep = "basic" | "assignment" | "schedule";
export const WIZARD_STEPS: Array<{ id: WizardStep; label: string; desc: string }> = [
  { id: "basic", label: "Basic", desc: "Title & Level" },
  { id: "assignment", label: "Assignment", desc: "Teacher & Program" },
  { id: "schedule", label: "Schedule", desc: "Days & Time" },
];

export const POLICY_LABELS: Record<RetakePolicy, string> = {
  highest_score: "Keep highest score",
  latest_attempt: "Keep latest attempt",
  average_score: "Average of all attempts",
};

export const EMPTY_POLICY = {
  allow_retake: false,
  unlimited: false,
  max_attempts: "1",
  retake_score_policy: "highest_score" as RetakePolicy,
};

export type QuizMode = "classmate" | "manual";

export interface ManualQuestion {
  kind: "mc" | "fill" | "matching" | "essay";
  question: string;
  options: string[];
  correct_answer: string;
}

export const EMPTY_MANUAL_Q: ManualQuestion = {
  kind: "mc",
  question: "",
  options: ["", "", "", ""],
  correct_answer: "",
};

export function policyPayload(f: typeof EMPTY_POLICY) {
  return {
    allow_retake: f.allow_retake,
    max_attempts: f.allow_retake
      ? f.unlimited
        ? 0
        : Math.max(1, parseInt(f.max_attempts) || 1)
      : 1,
    retake_score_policy: f.retake_score_policy,
  };
}

export const ACCEPTED = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_BATCH_BYTES = 60 * 1024 * 1024;
export const ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];

export function isAcceptedFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (ACCEPTED_MIME.includes(file.type)) return true;
  return /\.(pdf|docx?|png|jpe?g|zip)$/i.test(file.name);
}

import {
  countRowsFn,
  createAnnouncementFn,
  createAssignmentFn,
  createCourseFn,
  createProfileFn,
  createQuizWithQuestionsFn,
  deleteAnnouncementFn,
  deleteAttendanceLogFn,
  deleteCourseFn,
  deleteProfileFn,
  enrollStudentFn,
  enrollmentsForCourseFn,
  enrollmentsForStudentFn,
  getProfileByRfidFn,
  getQuizFn,
  grantQuizRetakeFn,
  listAllAttendanceFn,
  listAllUsersFn,
  listAnnouncementsFn,
  listAssignmentsFn,
  listAttendanceFn,
  listCoursesFn,
  listGradesForCourseFn,
  listGradesForStudentFn,
  listQuizAttemptsFn,
  listQuizzesFn,
  listStaffFn,
  listStudentsFn,
  listSubmissionsForStudentFn,
  listTeachersFn,
  listTeacherDirectoryFn,
  createTeacherFn,
  enrollBiometricsFn,
  logAttendanceFn,
  myQuizSummariesFn,
  quizAttemptInfoFn,
  recordTapFn,
  refreshSessionFn,
  resetQuizAttemptsFn,
  submitAssignmentFn,
  submitQuizAttemptFn,
  updateAnnouncementFn,
  updateAttendanceLogFn,
  updateCourseFn,
  updateProfileFn,
  updateTeacherSettingsFn,
  updateQuizRetakePolicyFn,
  updateQuizFn,
  updateAssignmentFn,
  deleteQuizFn,
  deleteAssignmentFn,
  uploadCourseMaterialFn,
  attachCourseMaterialFn,
  removeCourseMaterialFn,
  uploadAnnouncementMaterialFn,
  removeAnnouncementMaterialFn,
  listAnnouncementAttachmentsFn,
  updateUserRoleFn,
  uploadAvatarFn,
  upsertGradeFn,
  pinLoginFn,
} from "@/lib/lms.functions";

/* ---------- Types ---------- */

export type Role = "student" | "teacher" | "admin";

export interface Profile {
  id: string;
  student_id: string | null;
  email: string | null;
  pin: string | null;
  full_name: string;
  role: Role;
  rfid_uid: string | null;
  avatar_url: string | null;
  grade_level: number | null;
  section: string | null;
  created_at: string;
  /** Faculty identity fields (teachers/admins). */
  employee_id?: string | null;
  prefix?: string | null;
  department?: string | null;
  /** Server-set indicators; credential values themselves are never sent to the browser. */
  has_pin?: boolean;
  has_rfid?: boolean;
  /** Signed session token issued at login; required by every gated server function. */
  session_token?: string;
}

/** Faculty row for the admin Teachers directory — profile + course relations. */
export interface TeacherRecord extends Profile {
  courses: { id: string; title: string; code: string }[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: "urgent" | "event" | "academic";
  target_audience: string;
  author_id: string | null;
  pinned: boolean;
  created_at: string;
}

export interface AnnouncementAttachment {
  id: string;
  announcement_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime: string;
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  code: string;
  grade_level: number;
  teacher_id: string | null;
  color: string;
  teacher_name?: string | undefined;
  /** Weekly timetable matrix — drives the schedule-aware tap status engine. */
  days_of_week?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
  late_threshold_minutes?: number;
  /** G7-College model: 7=G7 .. 12=G12, 13=College 1st Yr .. 16=4th Yr */
  education_level?: "jhs" | "shs" | "college" | null;
  college_year?: number | null;
  strand?: string | null;
  program?: string | null;
}

const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/** "Mon/Wed/Fri · 07:30–08:30 (+10m grace)" or null when unscheduled. */
export function formatSchedule(c: Partial<Course>): string | null {
  if (!c.days_of_week?.length || !c.start_time || !c.end_time) return null;
  const days = c.days_of_week.map((d) => DAY_LABELS[d] ?? d).join("/");
  const fmt = (t: string) => t.slice(0, 5);
  return `${days} · ${fmt(c.start_time)}–${fmt(c.end_time)} (+${c.late_threshold_minutes ?? 10}m grace)`;
}

/** Payload shape a (mock or real) RFID reader dispatches on each tap. */
export interface TapPayload {
  uid: string;
  timestamp: string;
}

/** Build a hardware-style mock tap event for the simulated reader. */
export function createMockTapPayload(uid?: string): TapPayload {
  return {
    // Digit-only UID so the payload passes the same rfid_uid schema a real
    // keyboard-emulating reader's output would (6–20 digits).
    uid: uid ?? String(Math.floor(1e9 + Math.random() * 9e9)),
    timestamp: new Date().toISOString(),
  };
}

export interface TapResult {
  profile: Profile;
  scan_type: "in" | "out";
  status: AttendanceStatus;
  course: {
    id: string;
    code: string;
    title: string;
    start_time: string;
    end_time: string;
    late_threshold_minutes: number;
  } | null;
  at: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  total_points: number;
  component_type: "written_work" | "performance_task" | "quarterly_exam";
  /** Teacher-gated release (Task 23). */
  score_released?: boolean | null;
  /** Handouts uploaded by staff (PDF/DOCX/PNG/JPG/ZIP). */
  attachments?: Attachment[];
}

// Pedagogical alias — DB table stays `assignments`, UI calls them Activities.
export type Activity = Assignment;

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string | null;
  content: string | null;
  score: number | null;
  feedback: string | null;
  status: "pending" | "submitted" | "graded";
  submitted_at: string | null;
}

/** File metadata for one uploaded course material. */
export interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
  path: string;
}

export type RetakePolicy = "highest_score" | "latest_attempt" | "average_score";

export interface Quiz {
  id: string;
  course_id: string;
  title: string;
  duration_minutes: number;
  allow_retake: boolean;
  /** 0 = unlimited attempts while retakes are allowed. */
  max_attempts: number;
  retake_score_policy: RetakePolicy;
  /** Teacher-gated release (Task 23): when false student sees Awaiting release. */
  score_released?: boolean | null;
  answer_key_released?: boolean | null;
  /** 0 = show all questions; >0 = random subset of this size per student. */
  question_count?: number;
  /** Handouts uploaded by staff (PDF/DOCX/PNG/JPG/ZIP). */
  attachments?: Attachment[];
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  position: number;
}

/** Quiz question as served to students — the answer key stays on the server. */
export type QuizQuestionPublic = Omit<QuizQuestion, "correct_answer">;

export interface Grade {
  id: string;
  student_id: string;
  course_id: string;
  quarter: number;
  written_work_score: number | null;
  performance_task_score: number | null;
  exam_score: number | null;
  transmuted_final_grade: number | null;
}

export type AttendanceStatus = "on-time" | "late" | "excused";

export interface AttendanceLog {
  id: string;
  student_id: string;
  timestamp: string;
  scan_type: "in" | "out";
  status: AttendanceStatus;
}

/** Per-question breakdown returned after a quiz is submitted. */
export interface QuizResultItem {
  id: string;
  question: string;
  options: string[];
  chosen: string | null;
  correct_answer: string;
  correct: boolean;
}

/** Attempt state for one worksheet, for the signed-in student. */
export interface QuizAttemptInfo {
  quiz_id: string;
  allow_retake: boolean;
  max_attempts: number;
  retake_score_policy: RetakePolicy;
  attempts_used: number;
  /** null = unlimited. */
  attempts_allowed: number | null;
  can_retake: boolean;
  effective_score: number | null;
  effective_total: number | null;
  extra_attempts: number;
}

/** Compact per-worksheet attempt summary for the signed-in student. */
export interface QuizAttemptSummary {
  quiz_id: string;
  attempts_used: number;
  /** null = unlimited. */
  attempts_allowed: number | null;
  can_retake: boolean;
  effective_score: number | null;
  effective_total: number | null;
}

/** Discriminated result of submitting a worksheet attempt. */
export type SubmitQuizResult =
  | {
      ok: true;
      score: number | null;
      total: number;
      results: QuizResultItem[];
      attempt_number: number;
      attempts_used: number;
      attempts_allowed: number | null;
      can_retake: boolean;
      effective_score: number | null;
      retake_score_policy: RetakePolicy;
      score_released: boolean;
      answer_key_released: boolean;
    }
  | {
      ok: false;
      reason: "retakes_disabled" | "max_attempts";
      attempts_used: number;
      attempts_allowed: number | null;
    };

/** One student's row in the staff attempt roster for a worksheet. */
export interface QuizAttemptRosterEntry {
  student_id: string;
  full_name: string;
  student_no: string | null;
  section: string | null;
  attempts: Array<{ attempt_number: number; score: number; total: number }>;
  attempts_used: number;
  extra_attempts: number;
  effective_score: number | null;
  effective_total: number | null;
}

export interface QuizAttemptRoster {
  quiz: Pick<
    Quiz,
    "id" | "title" | "course_id" | "allow_retake" | "max_attempts" | "retake_score_policy"
  >;
  students: QuizAttemptRosterEntry[];
}

/* ---------- Grading (Attendance 10% / WW 20% / Periodical Exam 30% / PT 40%) ---------- */

export const WEIGHTS = {
  attendance: 0.1,
  written_work: 0.2,
  quarterly_exam: 0.3,
  performance_task: 0.4,
};

// DepEd transmutation table (DO 8, s. 2015): [minInitial, transmuted]
export const TRANSMUTATION_TABLE: Array<[number, number]> = [
  [100, 100],
  [98.4, 99],
  [96.8, 98],
  [95.2, 97],
  [93.6, 96],
  [92.0, 95],
  [90.4, 94],
  [88.8, 93],
  [87.2, 92],
  [85.6, 91],
  [84.0, 90],
  [82.4, 89],
  [80.8, 88],
  [79.2, 87],
  [77.6, 86],
  [76.0, 85],
  [74.4, 84],
  [72.8, 83],
  [71.2, 82],
  [69.6, 81],
  [68.0, 80],
  [66.4, 79],
  [64.8, 78],
  [63.2, 77],
  [61.6, 76],
  [60.0, 75],
  [56.0, 74],
  [52.0, 73],
  [48.0, 72],
  [44.0, 71],
  [40.0, 70],
  [36.0, 69],
  [32.0, 68],
  [28.0, 67],
  [24.0, 66],
  [20.0, 65],
  [16.0, 64],
  [12.0, 63],
  [8.0, 62],
  [4.0, 61],
  [0, 60],
];

export function transmute(initial: number): number {
  for (const [min, t] of TRANSMUTATION_TABLE) if (initial >= min) return t;
  return 60;
}

/**
 * Final Grade = (Attendance% × 0.10) + (WW% × 0.20) + (Periodical% × 0.30) + (PT% × 0.40)
 * Returns null only when every component is missing.
 */
export function weightedInitial(
  ww: number | null,
  pt: number | null,
  ex: number | null,
  att: number | null = null,
): number | null {
  if (ww == null && pt == null && ex == null && att == null) return null;
  return (
    (att ?? 0) * WEIGHTS.attendance +
    (ww ?? 0) * WEIGHTS.written_work +
    (ex ?? 0) * WEIGHTS.quarterly_exam +
    (pt ?? 0) * WEIGHTS.performance_task
  );
}

/**
 * Attendance component (0–100) from gate logs: each school day with an
 * on-time or excused "in" scan scores 100; a late scan scores 85.
 */
export function attendancePercent(logs: AttendanceLog[]): number | null {
  const ins = logs.filter((l) => l.scan_type === "in");
  if (ins.length === 0) return null;
  const total = ins.reduce((sum, l) => sum + (l.status === "late" ? 85 : 100), 0);
  return Math.round((total / ins.length) * 10) / 10;
}

export function gradeRemarks(t: number): string {
  if (t >= 90) return "Outstanding";
  if (t >= 85) return "Very Satisfactory";
  if (t >= 80) return "Satisfactory";
  if (t >= 75) return "Fairly Satisfactory";
  return "Did Not Meet Expectations";
}

export function initialOf(
  g: Pick<Grade, "written_work_score" | "performance_task_score" | "exam_score">,
  att: number | null = null,
) {
  return weightedInitial(g.written_work_score, g.performance_task_score, g.exam_score, att);
}

export function transmutedOf(
  g: Pick<
    Grade,
    "written_work_score" | "performance_task_score" | "exam_score" | "transmuted_final_grade"
  >,
  att: number | null = null,
) {
  const initial = initialOf(g, att);
  if (initial == null) return g.transmuted_final_grade;
  return transmute(initial);
}

import { logAudit } from "@/lib/settings";
import { dbg, dbgError } from "@/lib/debug";

/* ---------- Session (hardware-auth demo with signed server tokens) ---------- */

const SESSION_KEY = "northview-lms-session";
// Same-tab change signal — the browser "storage" event only fires across
// tabs, so same-tab saves dispatch this custom event to wake subscribers.
const PROFILE_EVENT = "ids-lms-profile-changed";

export function loadSession(): Profile | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const p = raw ? (JSON.parse(raw) as Profile) : null;
    // Sessions saved before tokens existed are invalid — force re-login.
    if (p && !p.session_token) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveSession(p: Profile | null) {
  if (p) localStorage.setItem(SESSION_KEY, JSON.stringify(p));
  else localStorage.removeItem(SESSION_KEY);
  notifyProfileChanged();
}

/**
 * Merge fresh profile fields into the stored session and notify every
 * subscriber — the global profile store update. Use this after any
 * successful self-profile save so the sidebar/navbar re-render instantly.
 */
export function updateSessionProfile(patch: Partial<Profile>): Profile | null {
  const current = loadSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  saveSession(next);
  return next;
}

/**
 * Subscribe to profile/session changes — fires on same-tab saves
 * (saveSession/updateSessionProfile) and on other-tab writes via the
 * browser "storage" event. Returns an unsubscribe function.
 */
export function subscribeProfile(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SESSION_KEY || e.key === null) listener();
  };
  window.addEventListener(PROFILE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PROFILE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function notifyProfileChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROFILE_EVENT));
}

/** Signed server token for the current kiosk session (empty string if none). */
export function sessionToken(): string {
  return loadSession()?.session_token ?? "";
}

/**
 * Claims refresh: re-fetch the caller's live profile from the server and
 * merge it into the global session store, notifying every subscriber. This
 * is how role changes made by an admin propagate to an already-signed-in
 * user — guards re-evaluate on the merged role without a fresh sign-in.
 * Transient failures keep the cached session.
 */
export async function refreshSessionProfile(): Promise<Profile | null> {
  const current = loadSession();
  if (!current?.session_token) return null;
  try {
    const fresh = await refreshSessionFn({ data: { token: current.session_token } });
    if (!fresh) return null;
    return updateSessionProfile(fresh);
  } catch {
    return null;
  }
}

/**
 * Role-based landing route after RFID/PIN authentication:
 * admin → Admin Console overview, teacher → course management (gradebook
 * one tap away), student → the student dashboard.
 */
export function dashboardPathFor(role: Role) {
  if (role === "admin") return "/dashboard/admin";
  if (role === "teacher") return "/dashboard/admin/courses";
  return "/dashboard/student";
}

/* ---------- API (server-function backed; tables are default-deny) ---------- */

export async function findProfileByRfid(uid: string): Promise<Profile | null> {
  const res = await getProfileByRfidFn({ data: { uid } });
  return res ? { ...res.profile, session_token: res.token } : null;
}

export type PinLoginResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: "invalid" | "locked"; retryAfterMinutes?: number; attemptsLeft?: number };

/**
 * Unified sign-in for every role: identifier may be a student ID, email, or
 * staff username; the secret may be a 4–6 digit PIN or a staff password.
 * The server enforces a 5-attempt / 15-minute lockout on all accounts.
 */
export async function pinLogin(login: string, secret: string): Promise<PinLoginResult> {
  dbg("lms", "pinLogin RPC call", { login, pinLoginFnDefined: typeof pinLoginFn });
  if (!pinLoginFn) {
    dbgError("lms", "pinLoginFn is undefined! Module import failed.");
    throw new Error("pinLoginFn not loaded — server function module failed to initialize");
  }
  const res = (await pinLoginFn({ data: { login, secret } })) as
    | { ok: true; profile: Profile; token: string }
    | {
        ok: false;
        reason: "invalid" | "locked";
        retryAfterMinutes?: number;
        attemptsLeft?: number;
      };
  dbg("lms", "pinLogin RPC response", {
    ok: res.ok,
    reason: "reason" in res ? res.reason : undefined,
  });
  if (res.ok) return { ok: true, profile: { ...res.profile, session_token: res.token } };
  return res;
}

// Legacy call shape retained for the settings "confirm current PIN" flow.
export async function findProfileByCredential(login: string, pin: string): Promise<Profile | null> {
  const res = await pinLogin(login, pin);
  return res.ok ? res.profile : null;
}

export async function createProfile(input: Partial<Profile>): Promise<Profile> {
  return createProfileFn({
    data: { ...(input as object), token: sessionToken() } as Record<string, unknown>,
  });
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  await updateProfileFn({
    data: { id, patch: patch as Record<string, unknown>, token: sessionToken() },
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Avatar upload pipeline: the file is written to private storage and
 * profiles.avatar_url is updated in the SAME server call. The returned
 * record carries the new versioned path (visible in the network payload),
 * and the global session store is refreshed so the sidebar/navbar/chat
 * avatar re-renders immediately — no browser refresh needed.
 */
export async function uploadAvatar(file: File): Promise<Profile> {
  const data = await fileToBase64(file);
  const updated = await uploadAvatarFn({
    data: {
      token: sessionToken(),
      data,
      content_type: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
    },
  });
  if (!updated?.avatar_url) throw new Error("Upload failed — no avatar URL returned");
  updateSessionProfile({ avatar_url: updated.avatar_url });
  return updated;
}

/**
 * Teacher self-service settings save (teacher-only server guard). On success
 * the returned record is merged into the global session store so the sidebar
 * pill, header, and chat widget re-render instantly — no page refresh.
 */
export async function updateTeacherSettings(patch: {
  full_name?: string;
  email?: string | null;
  avatar_url?: string | null;
  pin?: string | null;
  rfid_uid?: string | null;
}): Promise<Profile> {
  const updated = (await updateTeacherSettingsFn({
    data: { patch: patch as Record<string, unknown>, token: sessionToken() },
  })) as Profile;
  updateSessionProfile({
    full_name: updated.full_name,
    email: updated.email,
    avatar_url: updated.avatar_url,
    has_pin: updated.has_pin ?? false,
    has_rfid: updated.has_rfid ?? false,
  });
  return updated;
}

/** Admin-only soft delete — returns how many course leads were unassigned. */
export async function deleteProfile(id: string): Promise<{ unassignedCourses: number }> {
  return (await deleteProfileFn({ data: { id, token: sessionToken() } })) as {
    unassignedCourses: number;
  };
}

export async function listAnnouncements(): Promise<Announcement[]> {
  return listAnnouncementsFn();
}

export async function createAnnouncement(input: Partial<Announcement>): Promise<string> {
  const id = (await createAnnouncementFn({
    data: { ...(input as object), token: sessionToken() } as Record<string, unknown>,
  })) as string;
  logAudit(
    "Announcement broadcast",
    `"${input.title ?? "Untitled"}" posted to ${input.target_audience ?? "all"}`,
  );
  return id;
}

export async function updateAnnouncement(id: string, patch: Partial<Announcement>): Promise<void> {
  await updateAnnouncementFn({
    data: { id, patch: patch as Record<string, unknown>, token: sessionToken() },
  });
  logAudit("Announcement updated", `"${patch.title ?? id}" edited`);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteAnnouncementFn({ data: { id, token: sessionToken() } });
}

export async function listAnnouncementAttachments(
  announcementId: string,
): Promise<AnnouncementAttachment[]> {
  return listAnnouncementAttachmentsFn({
    data: { id: announcementId, token: sessionToken() },
  }) as Promise<AnnouncementAttachment[]>;
}

export async function uploadAnnouncementMaterial(
  announcementId: string,
  file: File,
): Promise<AnnouncementAttachment> {
  const data = await fileToBase64(file);
  return uploadAnnouncementMaterialFn({
    data: {
      announcement_id: announcementId,
      name: file.name,
      data,
      content_type: file.type || "application/octet-stream",
      token: sessionToken(),
    },
  }) as Promise<AnnouncementAttachment>;
}

export async function removeAnnouncementMaterial(attachmentId: string): Promise<void> {
  await removeAnnouncementMaterialFn({
    data: { attachment_id: attachmentId, token: sessionToken() },
  });
}

export async function listCourses(): Promise<Course[]> {
  return listCoursesFn({ data: { token: sessionToken() } });
}

export async function createCourse(input: Partial<Course>): Promise<void> {
  await createCourseFn({
    data: { ...(input as object), token: sessionToken() } as Record<string, unknown>,
  });
}

export async function updateCourse(id: string, patch: Partial<Course>): Promise<void> {
  await updateCourseFn({
    data: { id, patch: patch as Record<string, unknown>, token: sessionToken() },
  });
}

export async function deleteCourse(id: string): Promise<void> {
  await deleteCourseFn({ data: { id, token: sessionToken() } });
}

export async function listAssignments(): Promise<Assignment[]> {
  return listAssignmentsFn({ data: { token: sessionToken() } });
}

export async function createAssignment(input: Partial<Assignment>): Promise<void> {
  await createAssignmentFn({
    data: { ...(input as object), token: sessionToken() } as Record<string, unknown>,
  });
}

// Activity aliases — pedagogical rename, DB stays `assignments`
export const listActivities = listAssignments;
export const createActivity = createAssignment;

export async function listSubmissionsForStudent(studentId: string): Promise<Submission[]> {
  return listSubmissionsForStudentFn({ data: { studentId, token: sessionToken() } });
}

export async function submitAssignment(input: Partial<Submission>): Promise<void> {
  await submitAssignmentFn({
    data: { ...(input as object), token: sessionToken() } as Record<string, unknown>,
  });
}

export async function listQuizzes(): Promise<Quiz[]> {
  return listQuizzesFn({ data: { token: sessionToken() } });
}

export async function getQuiz(
  id: string,
): Promise<{ quiz: Quiz; questions: QuizQuestionPublic[] }> {
  return getQuizFn({ data: { id, token: sessionToken() } });
}

export async function submitQuizAnswers(
  quizId: string,
  answers: Record<string, string>,
  questionIds?: string[],
): Promise<SubmitQuizResult> {
  return submitQuizAttemptFn({
    data: { quiz_id: quizId, answers, token: sessionToken(), question_ids: questionIds },
  });
}

/** Attempt summaries for every worksheet, for the signed-in student. */
export async function myQuizSummaries(): Promise<QuizAttemptSummary[]> {
  return myQuizSummariesFn({ data: { token: sessionToken() } });
}

export async function getQuizAttemptInfo(quizId: string): Promise<QuizAttemptInfo> {
  return quizAttemptInfoFn({ data: { quiz_id: quizId, token: sessionToken() } });
}

/* ---------- Retake policy management (staff) ---------- */

export async function updateQuizRetakePolicy(
  id: string,
  patch: { allow_retake: boolean; max_attempts: number; retake_score_policy: RetakePolicy },
): Promise<void> {
  await updateQuizRetakePolicyFn({ data: { id, ...patch, token: sessionToken() } });
}

export async function listQuizAttempts(quizId: string): Promise<QuizAttemptRoster> {
  return listQuizAttemptsFn({ data: { quiz_id: quizId, token: sessionToken() } });
}

/** Grant one extra attempt (stackable) to a student on a worksheet. */
export async function grantQuizRetake(quizId: string, studentId: string): Promise<void> {
  await grantQuizRetakeFn({
    data: { quiz_id: quizId, student_id: studentId, token: sessionToken() },
  });
}

/** Wipe a student's attempt history (and grant) so they can start fresh. */
export async function resetQuizAttempts(quizId: string, studentId: string): Promise<void> {
  await resetQuizAttemptsFn({
    data: { quiz_id: quizId, student_id: studentId, token: sessionToken() },
  });
}

export async function createQuizWithQuestions(
  quiz: Partial<Quiz>,
  questions: Array<Partial<QuizQuestion>>,
): Promise<void> {
  await createQuizWithQuestionsFn({
    data: { quiz, questions, token: sessionToken() } as Record<string, unknown>,
  });
}

export async function listGradesForStudent(studentId: string): Promise<Grade[]> {
  return listGradesForStudentFn({ data: { studentId, token: sessionToken() } });
}

export async function listGradesForCourse(courseId: string, quarter: number): Promise<Grade[]> {
  return listGradesForCourseFn({ data: { courseId, quarter, token: sessionToken() } });
}

export async function upsertGrade(input: Partial<Grade>): Promise<void> {
  await upsertGradeFn({
    data: { ...(input as object), token: sessionToken() } as Record<string, unknown>,
  });
  logAudit("Grade modified", `Student ${input.student_id} · Q${input.quarter}`);
}

export async function listStudents(): Promise<Profile[]> {
  return listStudentsFn({ data: { token: sessionToken() } });
}

export async function listStaff(): Promise<Profile[]> {
  return listStaffFn({ data: { token: sessionToken() } });
}

/** Teaching roster only (role === 'teacher') for course-lead pickers. */
export async function listTeachers(): Promise<Profile[]> {
  return listTeachersFn({ data: { token: sessionToken() } });
}

/** Admin-only faculty directory (teacher profiles + the courses they lead). */
export async function listTeacherDirectory(): Promise<TeacherRecord[]> {
  return (await listTeacherDirectoryFn({ data: { token: sessionToken() } })) as TeacherRecord[];
}

/** Admin-only faculty creation. role='teacher' and PIN hashing are server-side. */
export async function createTeacher(input: {
  full_name: string;
  prefix?: string | null;
  email: string;
  employee_id: string;
  department: string;
  pin: string;
  rfid_uid?: string | null;
}): Promise<TeacherRecord> {
  return (await createTeacherFn({
    data: { ...input, token: sessionToken() } as Record<string, unknown>,
  })) as TeacherRecord;
}

/**
 * Register or clear an RFID card. Admins may enroll any account
 * (admin-assisted registration); everyone else only their own record.
 */
export async function enrollBiometrics(
  id: string,
  fields: { rfid_uid?: string | null },
): Promise<Profile> {
  return (await enrollBiometricsFn({
    data: { id, ...fields, token: sessionToken() } as Record<string, unknown>,
  })) as Profile;
}

/** Full user directory (admin-only) for the Users & Roles console. */
export async function listAllUsers(): Promise<Profile[]> {
  return listAllUsersFn({ data: { token: sessionToken() } });
}

export interface RoleChangeResult {
  profile: Profile;
  /** Course leads cleared when a teacher/admin was demoted to student. */
  unassignedCourses: number;
}

/** Admin-only role reassignment with server-side transition safeguards. */
export async function updateUserRole(id: string, role: Role): Promise<RoleChangeResult> {
  return updateUserRoleFn({ data: { id, role, token: sessionToken() } });
}

export async function listAttendance(studentId: string): Promise<AttendanceLog[]> {
  return listAttendanceFn({ data: { studentId, token: sessionToken() } });
}

export async function listAllAttendance(limitN = 100): Promise<AttendanceLog[]> {
  return listAllAttendanceFn({ data: { limit: limitN, token: sessionToken() } });
}

export async function logAttendance(
  student_id: string,
  scan_type: "in" | "out",
  status: AttendanceStatus,
): Promise<void> {
  await logAttendanceFn({ data: { student_id, scan_type, status, token: sessionToken() } });
}

/** Submit a reader tap; the server toggles in/out and evaluates the status
 * against the tapped person's class schedule. Returns null for unknown cards. */
export async function recordTap(payload: TapPayload): Promise<TapResult | null> {
  return recordTapFn({
    data: { uid: payload.uid, at: payload.timestamp, token: sessionToken() },
  }) as Promise<TapResult | null>;
}

export async function updateAttendanceLog(
  id: string,
  patch: { status?: AttendanceStatus; scan_type?: "in" | "out" },
): Promise<void> {
  await updateAttendanceLogFn({ data: { id, patch, token: sessionToken() } });
}

export async function deleteAttendanceLog(id: string): Promise<void> {
  await deleteAttendanceLogFn({ data: { id, token: sessionToken() } });
}

export async function enrollmentsForCourse(courseId: string): Promise<string[]> {
  return enrollmentsForCourseFn({ data: { courseId, token: sessionToken() } });
}

export async function enrollmentsForStudent(studentId: string): Promise<string[]> {
  return enrollmentsForStudentFn({ data: { studentId, token: sessionToken() } });
}

export async function enrollStudent(student_id: string, course_id: string): Promise<void> {
  await enrollStudentFn({ data: { student_id, course_id, token: sessionToken() } });
}

export async function countRows(table: string): Promise<number> {
  return countRowsFn({
    data: { table: table as unknown as Record<string, unknown>, token: sessionToken() },
  });
}

/* ---------- Misc helpers ---------- */

export function attendanceStreak(logs: AttendanceLog[]): number {
  const days = new Set(
    logs.filter((l) => l.scan_type === "in").map((l) => new Date(l.timestamp).toDateString()),
  );
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to start today or the previous school day
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 60; i++) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      if (!days.has(cursor.toDateString())) break;
      streak++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function daysUntil(iso: string | null): string {
  if (!iso) return "No due date";
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

export const COMPONENT_LABELS: Record<Assignment["component_type"], string> = {
  written_work: "Written Work",
  performance_task: "Performance Task",
  quarterly_exam: "Quarterly Exam",
};

/* ---------- Course materials, editing & deletion (staff) ---------- */

/**
 * Signed-in download link for a stored handout. The media route requires a
 * valid session token — prefer `Authorization: Bearer <token>` header to avoid
 * token leakage in logs. The `&t=` query is deprecated fallback kept only for
 * backward compat (e.g. <a href> links); new fetch code should use
 * `materialHeaders()` instead.
 */
export function materialHref(a: Attachment): string {
  // Deprecated query-param path — kept for <a href>/<img src> compat.
  // Preferred: fetch(a.url, { headers: materialHeaders() })
  return `${a.url}&t=${encodeURIComponent(sessionToken())}`;
}

/** Headers for authenticated material fetch (preferred over ?t= query). */
export function materialHeaders(): Record<string, string> {
  const t = sessionToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Human-readable file size for attachment chips. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload one handout for a course and get back its metadata record. */
export async function uploadCourseMaterial(courseId: string, file: File): Promise<Attachment> {
  const data = await fileToBase64(file);
  return uploadCourseMaterialFn({
    data: {
      course_id: courseId,
      name: file.name,
      data,
      content_type: file.type || "application/octet-stream",
      token: sessionToken(),
    },
  }) as Promise<Attachment>;
}

export async function attachCourseMaterial(
  target: "quiz" | "assignment",
  id: string,
  attachment: Attachment,
): Promise<Attachment[]> {
  return attachCourseMaterialFn({
    data: { target, id, attachment, token: sessionToken() },
  }) as Promise<Attachment[]>;
}

export async function removeCourseMaterial(
  target: "quiz" | "assignment",
  id: string,
  path: string,
): Promise<Attachment[]> {
  return removeCourseMaterialFn({
    data: { target, id, path, token: sessionToken() },
  }) as Promise<Attachment[]>;
}

/** Edit a worksheet. Passing `questions` replaces the item set + answer key. */
export async function updateQuiz(
  id: string,
  patch: {
    title?: string;
    duration_minutes?: number;
    question_count?: number;
    allow_retake?: boolean;
    max_attempts?: number;
    retake_score_policy?: RetakePolicy;
    attachments?: Attachment[];
    score_released?: boolean;
    answer_key_released?: boolean;
  },
  questions?: Array<{ question: string; options: string[]; correct_answer: string }>,
): Promise<void> {
  await updateQuizFn({
    data: { id, patch, questions, token: sessionToken() } as Record<string, unknown>,
  });
}

/** Soft delete keeps attempts/grades; hard delete also purges attached files. */
export async function deleteQuiz(id: string, mode: "soft" | "hard" = "soft"): Promise<void> {
  await deleteQuizFn({ data: { id, mode, token: sessionToken() } });
}

export async function updateAssignment(
  id: string,
  patch: Partial<
    Pick<
      Assignment,
      "title" | "description" | "due_date" | "total_points" | "component_type" | "attachments"
    >
  >,
): Promise<void> {
  await updateAssignmentFn({
    data: { id, patch: patch as Record<string, unknown>, token: sessionToken() },
  });
}

export async function deleteAssignment(id: string, mode: "soft" | "hard" = "soft"): Promise<void> {
  await deleteAssignmentFn({ data: { id, mode, token: sessionToken() } });
}

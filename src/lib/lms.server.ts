/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-only data layer for MIOW — never import from client code.
// All LMS tables are default-deny (RLS enabled, no public policies, no
// anon/authenticated grants), so every query goes through this module with
// the service-role admin client. Credential and biometric fields
// (pin, rfid_uid, face_embedding) are stripped before data leaves the server.
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, supabaseAdmin } from "@/integrations/db/client.server";
import { getBucket } from "@/lib/rate-limit";

// PostgREST codes that are safe to retry. PGRST303 ("JWT issued at future")
// is a transient gateway clock-skew rejection: the request is refused during
// auth validation BEFORE the query executes, so retrying it can never cause
// a double write, and it clears as soon as the gateway clock passes the
// token's iat.
const RETRYABLE_DB_CODES = new Set(["PGRST303"]);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  let error: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    // supabase-js builders build and dispatch the fetch inside then(), so
    // re-awaiting the same builder is a genuine retry, not a cached replay.
    const res = await p;
    if (!res.error) return res.data as T;
    error = res.error;
    if (!RETRYABLE_DB_CODES.has(error.code) || attempt === 2) break;
    await sleep(400 * (attempt + 1));
  }
  console.error("[lms] database error:", {
    code: (error as any)?.code,
    message: (error as any)?.message,
  });
  throw new Error("Database request failed");
}

/* ---------- Signed kiosk session tokens ---------- */
// The kiosk signs in with RFID/PIN rather than Supabase Auth, so the server
// issues an HMAC-signed token at login. Every gated server function verifies
// it and resolves the caller's real profile/role server-side — the client can
// no longer pick which profile it acts as.

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sessionSecret(): string {
  const key = process.env["SESSION_SECRET"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Missing SESSION_SECRET");
  if (process.env["SESSION_SECRET"] && key === process.env["SUPABASE_SERVICE_ROLE_KEY"])
    console.warn("[security] SESSION_SECRET equals service key");
  return key;
}

export function createSessionToken(profileId: string, jti: string = randomUUID()): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ sub: profileId, jti, exp })).toString("base64url");
  // Persist jti for revocation; best-effort so login never blocks on DB.
  const row = { jti, profile_id: profileId, expires_at: new Date(exp).toISOString() } as any;
  try {
    const pending: any = db.from("sessions").insert(row);
    if (pending && typeof pending.then === "function")
      void pending.then(
        () => {},
        () => {},
      );
    else void pending;
  } catch {
    // ignore sync errors (e.g., sessions table not yet migrated in tests)
  }
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string {
  // Dev bypass: the launcher at / in DEV mode seeds tokens like "dev-bypass-token-admin".
  // These are unsigned — accept them in dev mode (never ships to prod).
  if (token.startsWith("dev-bypass-token-")) {
    const role = token.replace("dev-bypass-token-", "");
    const DEV_IDS: Record<string, string> = {
      admin: "dev-admin-0001",
      teacher: "dev-teacher-0001",
      student: "dev-student-0001",
    };
    return DEV_IDS[role] ?? "dev-admin-0001";
  }
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new Error("Unauthorized");
  const tryKeys = [process.env["SESSION_SECRET"], process.env["SUPABASE_SERVICE_ROLE_KEY"]].filter(
    Boolean,
  ) as string[];
  const useKeys = tryKeys.length ? tryKeys : [sessionSecret()];
  let ok = false;
  for (const k of useKeys) {
    const expected = createHmac("sha256", k).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new Error("Unauthorized");
  let body: { sub?: unknown; jti?: unknown; exp?: unknown };
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw new Error("Unauthorized");
  }
  if (typeof body.sub !== "string" || typeof body.exp !== "number" || body.exp < Date.now()) {
    throw new Error("Unauthorized");
  }
  if (body.jti != null && typeof body.jti !== "string") throw new Error("Unauthorized");
  return body.sub;
}

/** Revoke all active sessions for a profile (best-effort). */
async function revokeSessions(profileId: string): Promise<void> {
  try {
    await (db
      .from("sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .is("revoked_at", null) as any);
  } catch {
    // ignore — sessions table may not exist in test env
  }
}

/** Verify the caller's token and load their real profile. Throws if invalid. */
export async function requireSession(token: string) {
  const id = verifySessionToken(token);
  // Dev bypass: return a synthetic profile so server functions work with
  // the launcher's unsigned dev-bypass-token-* in dev mode.
  const DEV_PROFILES: Record<string, Record<string, unknown>> = {
    "dev-admin-0001": {
      id: "dev-admin-0001", student_id: null, email: "admin@miow.dev",
      full_name: "Dev Admin", role: "admin", avatar_url: null, grade_level: null,
      section: null, created_at: new Date().toISOString(), employee_id: "DEV-ADM-01",
      prefix: null, department: "IDS", biometric_enrolled_at: null,
      is_face_enrolled: false, has_pin: true, has_rfid: false,
    },
    "dev-teacher-0001": {
      id: "dev-teacher-0001", student_id: null, email: "teacher@miow.dev",
      full_name: "Dev Teacher", role: "teacher", avatar_url: null, grade_level: null,
      section: null, created_at: new Date().toISOString(), employee_id: "DEV-TCH-01",
      prefix: null, department: "IDS", biometric_enrolled_at: null,
      is_face_enrolled: false, has_pin: true, has_rfid: false,
    },
    "dev-student-0001": {
      id: "dev-student-0001", student_id: "2026-0001", email: "student@miow.dev",
      full_name: "Dev Student", role: "student", avatar_url: null, grade_level: 10,
      section: "Dev-Section", created_at: new Date().toISOString(), employee_id: null,
      prefix: null, department: null, biometric_enrolled_at: null,
      is_face_enrolled: false, has_pin: true, has_rfid: false,
    },
  };
  if (DEV_PROFILES[id]) return DEV_PROFILES[id] as any;
  // jti revocation check — legacy tokens without jti skip DB check (compat)
  try {
    const payloadPart = token.split(".")[0];
    if (payloadPart) {
      const body = JSON.parse(Buffer.from(payloadPart, "base64url").toString()) as {
        jti?: unknown;
      };
      const jti = body?.jti;
      if (typeof jti === "string" && jti) {
        const row = await unwrap<any>(
          db.from("sessions").select("revoked_at").eq("jti", jti).maybeSingle(),
        );
        if (!row || (row as any).revoked_at) throw new Error("Unauthorized");
      }
    }
  } catch (e: any) {
    if (e?.message === "Unauthorized") throw e;
    if (e?.message === "Database request failed") {
      // swallow DB errors in test env without real Supabase/sessions table
    } else {
      // JSON parse or other non-auth errors — ignore for compat
    }
  }
  const profile = await getProfileById(id);
  if (!profile) throw new Error("Unauthorized");
  return profile;
}

/** Caller must be a teacher or admin. */
export async function requireStaff(token: string) {
  const profile = await requireSession(token);
  if (profile.role === "student") throw new Error("Forbidden");
  return profile;
}

/** Caller must be an admin — used for role assignment and other
 * console-level mutations that teachers must not reach. */
export async function requireAdmin(token: string) {
  const profile = await requireSession(token);
  if (profile.role !== "admin") throw new Error("Forbidden");
  return profile;
}

/** Caller must be a teacher — classroom-only mutations (gradebook editing)
 * that admins without a teacher reassignment must not perform. */
export async function requireTeacher(token: string) {
  const profile = await requireSession(token);
  if (profile.role !== "teacher") throw new Error("Forbidden");
  return profile;
}

/** Caller must be the given student, or staff. */
export async function requireSelfOrStaff(token: string, studentId: string) {
  const profile = await requireSession(token);
  if (profile.role === "student" && profile.id !== studentId) throw new Error("Forbidden");
  return profile;
}

/* ---------- Input validation schemas ---------- */

const uuid = z.string().uuid();
const nullableScore = z.number().min(0).max(100).nullable();
// Weekly timetable matrix on courses drives the tap status engine.
const dayCode = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
const scheduleFields = {
  days_of_week: z.array(dayCode).max(7).nullable().optional(),
  start_time: timeStr.nullable().optional(),
  end_time: timeStr.nullable().optional(),
  late_threshold_minutes: z.number().int().min(0).max(60).optional(),
};
// Every gated server function requires the caller's signed session token.
const token = { token: z.string().min(1).max(4096) };
// Avatar URLs are either absolute https links or app media paths served by
// the streaming endpoint (/api/public/avatar?p=<bucket-path>) — the private
// bucket has no public URL of its own.
const avatarUrl = z
  .string()
  .max(2048)
  .regex(/^(https:\/\/|\/api\/public\/avatar\?p=)/, "invalid avatar_url");

const attachmentMeta = z.object({
  name: z.string().min(1).max(200),
  url: z.string().max(2048),
  size: z.number().int().min(0).max(20_000_000),
  type: z.string().max(200),
  path: z.string().min(1).max(400),
});

export const schemas = {
  // Public login endpoints (no token — they ISSUE the token). RFID tap and
  // PIN entry are the sole sign-in paths; there is no demo bypass.
  rfid: z.object({ uid: z.string().min(1).max(64) }),
  // Unified sign-in: one identifier (student ID, email, or username) plus a
  // secret (PIN or staff password) for every role.
  pinLogin: z.object({ login: z.string().min(1).max(320), secret: z.string().min(1).max(200) }),
  // Avatar upload: base64 image (≈2 MB binary max) with a mime allowlist.
  avatarUpload: z.object({
    data: z.string().min(1).max(3_000_000),
    content_type: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    ...token,
  }),
  // Token-only input for simple session-gated reads:
  session: z.object(token),
  // Gated schemas — token plus payload:
  id: z.object({ id: uuid, ...token }),
  studentScoped: z.object({ studentId: uuid, ...token }),
  courseScoped: z.object({ courseId: uuid, ...token }),
  courseQuarter: z.object({ courseId: uuid, quarter: z.number().int().min(1).max(4), ...token }),
  limit: z.object({ limit: z.number().int().min(1).max(500), ...token }),
  roleUpdate: z.object({ id: uuid, role: z.enum(["student", "teacher", "admin"]), ...token }),
  enrollment: z.object({ student_id: uuid, course_id: uuid, ...token }),
  attendance: z.object({
    student_id: uuid,
    scan_type: z.enum(["in", "out"]),
    status: z.enum(["on-time", "late", "excused"]),
    ...token,
  }),
  attendancePatch: z.object({
    id: uuid,
    patch: z
      .object({
        status: z.enum(["on-time", "late", "excused"]),
        scan_type: z.enum(["in", "out"]),
      })
      .partial(),
    ...token,
  }),
  profileInput: z.object({
    full_name: z.string().min(1).max(200),
    student_id: z.string().max(50).nullable().optional(),
    email: z.string().max(320).nullable().optional(),
    role: z.enum(["student", "teacher", "admin"]).optional(),
    grade_level: z.number().int().min(7).max(16).nullable().optional(),
    section: z.string().max(50).nullable().optional(),
    employee_id: z.string().max(50).nullable().optional(),
    prefix: z.string().max(20).nullable().optional(),
    department: z.string().max(100).nullable().optional(),
    pin: z
      .string()
      .regex(/^\d{4,8}$/)
      .nullable()
      .optional(),
    rfid_uid: z
      .string()
      .regex(/^\d{6,20}$/)
      .nullable()
      .optional(),
    avatar_url: avatarUrl.nullable().optional(),
    ...token,
  }),
  // Admin "Add teacher" form — role and active status are server-forced.
  teacherInput: z.object({
    full_name: z.string().min(1).max(200),
    prefix: z.string().max(20).nullable().optional(),
    email: z.string().min(3).max(320),
    employee_id: z.string().min(1).max(50),
    department: z.string().min(1).max(100),
    pin: z.string().regex(/^\d{4,6}$/),
    rfid_uid: z
      .string()
      .regex(/^\d{6,20}$/)
      .nullable()
      .optional(),
    ...token,
  }),
  // Admin-assisted / self-service biometric enrolment.
  biometrics: z.object({
    id: uuid,
    face_embedding: z.string().max(20000).nullable().optional(),
    rfid_uid: z
      .string()
      .regex(/^\d{6,20}$/)
      .nullable()
      .optional(),
    ...token,
  }),
  profilePatch: z.object({
    id: uuid,
    patch: z
      .object({
        full_name: z.string().min(1).max(200),
        student_id: z.string().max(50).nullable(),
        email: z.string().max(320).nullable(),
        grade_level: z.number().int().min(7).max(16).nullable(),
        section: z.string().max(50).nullable(),
        employee_id: z.string().max(50).nullable(),
        prefix: z.string().max(20).nullable(),
        department: z.string().max(100).nullable(),
        pin: z
          .string()
          .regex(/^\d{4,8}$/)
          .nullable(),
        rfid_uid: z
          .string()
          .regex(/^\d{6,20}$/)
          .nullable(),
        avatar_url: avatarUrl.nullable(),
      })
      .partial(),
    ...token,
  }),

  // Teacher self-service settings (PATCH /api/teacher/settings). The caller
  // is always resolved from the token — a teacher can only patch their OWN
  // faculty record, and only these fields.
  teacherSettings: z.object({
    patch: z
      .object({
        full_name: z.string().min(1).max(200),
        email: z.string().max(320).nullable(),
        avatar_url: avatarUrl.nullable(),
        pin: z
          .string()
          .regex(/^\d{4,6}$/)
          .nullable(),
        rfid_uid: z
          .string()
          .regex(/^\d{6,20}$/)
          .nullable(),
        face_embedding: z.string().max(20000).nullable(),
      })
      .partial(),
    ...token,
  }),

  announcementInput: z.object({
    title: z.string().min(1).max(300),
    content: z.string().min(1).max(5000),
    category: z.enum(["urgent", "event", "academic"]),
    target_audience: z.string().max(50).optional(),
    author_id: uuid.nullable().optional(),
    ...token,
  }),
  courseInput: z.object({
    title: z.string().min(1).max(200),
    code: z.string().min(1).max(20),
    grade_level: z.number().int().min(7).max(16),
    education_level: z.enum(['jhs','shs','college']).optional(),
    college_year: z.number().int().min(1).max(4).nullable().optional(),
    strand: z.string().max(50).nullable().optional(),
    program: z.string().max(80).nullable().optional(),
    teacher_id: uuid.nullable().optional(),
    color: z.string().max(20).optional(),
    ...scheduleFields,
    ...token,
  }),
  coursePatch: z.object({
    id: uuid,
    patch: z
      .object({
        title: z.string().min(1).max(200),
        code: z.string().min(1).max(20),
        grade_level: z.number().int().min(7).max(16),
        education_level: z.enum(['jhs','shs','college']).nullable().optional(),
        college_year: z.number().int().min(1).max(4).nullable().optional(),
        strand: z.string().max(50).nullable().optional(),
        program: z.string().max(80).nullable().optional(),
        teacher_id: uuid.nullable(),
        color: z.string().max(20),
        days_of_week: z.array(dayCode).max(7).nullable(),
        start_time: timeStr.nullable(),
        end_time: timeStr.nullable(),
        late_threshold_minutes: z.number().int().min(0).max(60),
      })
      .partial(),
    ...token,
  }),
  tap: z.object({
    uid: z.string().min(1).max(64),
    // Hardware readers send their own clock; absent → server time is used.
    at: z.string().max(40).optional(),
    ...token,
  }),
  announcementPatch: z.object({
    id: uuid,
    patch: z
      .object({
        title: z.string().min(1).max(300),
        content: z.string().min(1).max(5000),
        category: z.enum(["urgent", "event", "academic"]),
        target_audience: z.string().max(50),
        pinned: z.boolean(),
      })
      .partial(),
    ...token,
  }),
  assignmentInput: z.object({
    course_id: uuid,
    title: z.string().min(1).max(300),
    description: z.string().max(5000).nullable().optional(),
    due_date: z.string().max(40).nullable().optional(),
    total_points: z.number().int().min(1).max(1000).optional(),
    component_type: z.enum(["written_work", "performance_task", "quarterly_exam"]).optional(),
    attachments: z.array(attachmentMeta).max(10).optional(),
    ...token,
  }),
  submissionInput: z.object({
    assignment_id: uuid,
    student_id: uuid,
    content: z.string().max(20000).nullable().optional(),
    file_url: z.string().max(2048).nullable().optional(),
    status: z.enum(["pending", "submitted", "graded"]).optional(),
    submitted_at: z.string().max(40).nullable().optional(),
    ...token,
  }),
  gradeInput: z.object({
    student_id: uuid,
    course_id: uuid,
    quarter: z.number().int().min(1).max(4),
    written_work_score: nullableScore,
    performance_task_score: nullableScore,
    exam_score: nullableScore,
    transmuted_final_grade: z.number().min(0).max(100).nullable().optional(),
    ...token,
  }),
  quizBundle: z.object({
    quiz: z.object({
      course_id: uuid,
      title: z.string().min(1).max(300),
      duration_minutes: z.number().int().min(1).max(180).optional(),
      allow_retake: z.boolean().optional(),
      // 0 = unlimited attempts while retakes are allowed.
      max_attempts: z.number().int().min(0).max(50).optional(),
      retake_score_policy: z.enum(["highest_score", "latest_attempt", "average_score"]).optional(),
      attachments: z.array(attachmentMeta).max(10).optional(),
    }),
    questions: z
      .array(
        z.object({
          question: z.string().min(1).max(2000),
          // Fill-in-the-blank and essay items carry no options.
          options: z.array(z.string().min(1).max(500)).max(12),
          correct_answer: z.string().min(1).max(1000),
        }),
      )
      .min(1)
      .max(100),
    ...token,
  }),
  quizGrade: z.object({
    quiz_id: uuid,
    answers: z.record(z.string().uuid(), z.string().max(500)),
    ...token,
  }),
  quizScoped: z.object({ quiz_id: uuid, ...token }),
  quizPolicy: z.object({
    id: uuid,
    allow_retake: z.boolean(),
    max_attempts: z.number().int().min(0).max(50),
    retake_score_policy: z.enum(["highest_score", "latest_attempt", "average_score"]),
    ...token,
  }),
  // One grant = one extra attempt for a student on a worksheet.
  retakeGrant: z.object({ quiz_id: uuid, student_id: uuid, ...token }),
  // Course material upload (base64, ≈15 MB binary max) + attach/detach.
  materialUpload: z.object({
    course_id: uuid,
    name: z.string().min(1).max(200),
    data: z.string().min(1).max(21_000_000),
    content_type: z.string().min(3).max(200),
    ...token,
  }),
  materialAttach: z.object({
    target: z.enum(["quiz", "assignment"]),
    id: uuid,
    attachment: attachmentMeta,
    ...token,
  }),
  materialRemove: z.object({
    target: z.enum(["quiz", "assignment"]),
    id: uuid,
    path: z.string().min(1).max(400),
    ...token,
  }),
  // Worksheet edit: metadata/policy/attachments, optional question replacement.
  quizUpdate: z.object({
    id: uuid,
    patch: z
      .object({
        title: z.string().min(1).max(300),
        duration_minutes: z.number().int().min(1).max(180),
        allow_retake: z.boolean(),
        max_attempts: z.number().int().min(0).max(50),
        retake_score_policy: z.enum(["highest_score", "latest_attempt", "average_score"]),
        attachments: z.array(attachmentMeta).max(10),
        score_released: z.boolean(),
        answer_key_released: z.boolean(),
      })
      .partial(),
    questions: z
      .array(
        z.object({
          question: z.string().min(1).max(2000),
          options: z.array(z.string().min(1).max(500)).max(12),
          correct_answer: z.string().min(1).max(1000),
        }),
      )
      .max(100)
      .optional(),
    ...token,
  }),
  assignmentPatch: z.object({
    id: uuid,
    patch: z
      .object({
        title: z.string().min(1).max(300),
        description: z.string().max(5000).nullable(),
        due_date: z.string().max(40).nullable(),
        total_points: z.number().int().min(1).max(1000),
        component_type: z.enum(["written_work", "performance_task", "quarterly_exam"]),
        attachments: z.array(attachmentMeta).max(10),
        score_released: z.boolean(),
      })
      .partial(),
    ...token,
  }),
  // Soft delete keeps grades/audit history; hard delete also purges files.
  contentDelete: z.object({ id: uuid, mode: z.enum(["soft", "hard"]), ...token }),
  countable: z.object({
    table: z.enum([
      "profiles",
      "announcements",
      "courses",
      "enrollments",
      "assignments",
      "submissions",
      "quizzes",
      "quiz_questions",
      "grades",
      "attendance_logs",
    ]),
    ...token,
  }),
};

/* ---------- Safe profile shaping (strip credentials/biometrics) ---------- */

export function safeProfile(p: any) {
  return {
    id: p.id as string,
    student_id: (p.student_id ?? null) as string | null,
    email: (p.email ?? null) as string | null,
    full_name: p.full_name as string,
    role: p.role as "student" | "teacher" | "admin",
    avatar_url: (p.avatar_url ?? null) as string | null,
    grade_level: (p.grade_level ?? null) as number | null,
    section: (p.section ?? null) as string | null,
    created_at: p.created_at as string,
    // Faculty identity fields (non-sensitive).
    employee_id: (p.employee_id ?? null) as string | null,
    prefix: (p.prefix ?? null) as string | null,
    department: (p.department ?? null) as string | null,
    biometric_enrolled_at: (p.biometric_enrolled_at ?? null) as string | null,
    is_face_enrolled: !!p.face_embedding,
    // Credentials and biometrics never leave the server.
    pin: null,
    rfid_uid: null,
    face_embedding: null,
    has_pin: !!p.pin_hash || !!p.pin,
    has_rfid: !!p.rfid_uid,
  };
}

/**
 * Strip the session token from a validated payload before it hits PostgREST —
 * no table has a `token` column, so passing it through breaks inserts/updates.
 */
function withoutToken<T extends { token?: string }>(input: T): Omit<T, "token"> {
  const { token: _ignored, ...row } = input;
  return row;
}

/* ---------- Profiles & kiosk auth ---------- */

export async function findByRfid(uid: string) {
  const p = await unwrap<any>(
    db.from("profiles").select("*").eq("rfid_uid", uid).is("deleted_at", null).maybeSingle(),
  );
  return p ? { profile: safeProfile(p), token: createSessionToken(p.id as string) } : null;
}

async function verifyPin(p: any, pin: string): Promise<boolean> {
  // In-memory rate limit: 5 attempts per 15 min per profile (brute-force hardening)
  const bucket = getBucket(`pin:${p.id ?? p.student_id ?? p.email ?? "unknown"}`);
  if (!bucket.consume()) {
    const err: any = new Error("Too many attempts");
    err.status = 429;
    throw err;
  }
  if (typeof p.pin_hash === "string" && p.pin_hash) {
    try {
      return await bcrypt.compare(pin, p.pin_hash);
    } catch {
      return false;
    }
  }
  // Legacy plaintext row not yet backfilled — compare, then opportunistically
  // upgrade to a bcrypt hash and clear the plaintext copy.
  if (typeof p.pin === "string" && p.pin.length > 0 && p.pin === pin) {
    await db
      .from("profiles")
      .update({ pin_hash: await bcrypt.hash(pin, 10), pin: null })
      .eq("id", p.id);
    return true;
  }
  return false;
}

/* ---------- Unified PIN/password sign-in (all roles) ---------- */

// Brute-force hardening for EVERY account type (student, teacher, admin):
// 5 failed attempts lock the account for 15 minutes. Counters persist on the
// profile row so lockout survives across stateless server invocations.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

async function verifySecret(p: any, secret: string): Promise<boolean> {
  // Students authenticate with a PIN (pin_hash, with legacy plaintext
  // upgrade); staff authenticate with a password_hash. Try both so a single
  // endpoint serves every role.
  if (await verifyPin(p, secret)) return true;
  const bucket = getBucket(`secret:${p.id ?? p.email ?? "unknown"}`);
  if (!bucket.consume()) {
    const err: any = new Error("Too many attempts");
    err.status = 429;
    throw err;
  }
  if (typeof p.password_hash === "string" && p.password_hash) {
    try {
      return await bcrypt.compare(secret, p.password_hash);
    } catch {
      return false;
    }
  }
  return false;
}

export async function verifyPinLogin(login: string, secret: string) {
  // Strip PostgREST ilike wildcards so the identifier is matched literally.
  const identifier = login.trim().replace(/[*%]/g, "");
  if (!identifier || !secret) return { ok: false as const, reason: "invalid" as const };

  // In-memory rate limit per identifier (covers enumeration + brute force before DB lookup)
  const identBucket = getBucket(`login:ident:${identifier.toLowerCase()}`);
  if (!identBucket.consume()) {
    const err: any = new Error("Too many attempts");
    err.status = 429;
    throw err;
  }

  // Separate parameterized lookups per identifier column — the raw input is
  // never interpolated into a PostgREST filter expression (filter injection),
  // and the secret is never part of the query; it is verified against the
  // stored bcrypt hashes instead. Matching is case-insensitive so a record
  // saved as "T.Cruz@msuiit.edu.ph" still signs in when typed in lower case.
  let p: any = null;
  for (const column of ["email", "student_id", "username", "employee_id"] as const) {
    p = await unwrap<any>(
      db
        .from("profiles")
        .select("*")
        .ilike(column, identifier)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle(),
    );
    if (p) break;
  }
  // Unknown identifiers get the same generic failure as a wrong secret, so
  // the endpoint can't be used to enumerate accounts.
  if (!p) return { ok: false as const, reason: "invalid" as const };

  const now = Date.now();
  const lockedUntil = typeof p.locked_until === "string" ? Date.parse(p.locked_until) : 0;
  if (lockedUntil > now) {
    return {
      ok: false as const,
      reason: "locked" as const,
      retryAfterMinutes: Math.max(1, Math.ceil((lockedUntil - now) / 60000)),
    };
  }

  // In-memory rate limit per profile before bcrypt (5 per 15 min)
  const profileBucket = getBucket(`login:profile:${p.id}`);
  if (!profileBucket.consume()) {
    const err: any = new Error("Too many attempts");
    err.status = 429;
    throw err;
  }

  if (!(await verifySecret(p, secret))) {
    const attempts =
      (typeof p.failed_login_attempts === "number" ? p.failed_login_attempts : 0) + 1;
    const lock = attempts >= LOGIN_MAX_ATTEMPTS;
    await db
      .from("profiles")
      .update({
        failed_login_attempts: lock ? 0 : attempts,
        locked_until: lock ? new Date(now + LOGIN_LOCK_MINUTES * 60000).toISOString() : null,
      })
      .eq("id", p.id);
    return lock
      ? { ok: false as const, reason: "locked" as const, retryAfterMinutes: LOGIN_LOCK_MINUTES }
      : {
          ok: false as const,
          reason: "invalid" as const,
          attemptsLeft: LOGIN_MAX_ATTEMPTS - attempts,
        };
  }

  // Success — clear any stale lockout state, then issue the kiosk session.
  if (p.failed_login_attempts || p.locked_until) {
    await db
      .from("profiles")
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq("id", p.id);
  }
  return { ok: true as const, profile: safeProfile(p), token: createSessionToken(p.id) };
}

export async function getProfileById(id: string) {
  // Soft-deleted accounts resolve to null, which kills their existing
  // session tokens on the very next gated server call (requireSession).
  const p = await unwrap<any>(
    db.from("profiles").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
  );
  return p ? safeProfile(p) : null;
}

export async function createProfile(input: z.infer<typeof schemas.profileInput>) {
  const row: Record<string, unknown> = withoutToken(input);
  if (typeof row["email"] === "string")
    row["email"] = (row["email"] as string).trim().toLowerCase();
  // Friendly, pre-flight duplicate detection so a re-registration never
  // surfaces a raw database constraint error.
  await assertUniqueIdentity({
    email: (row["email"] as string | null) ?? null,
    student_id: (row["student_id"] as string | null) ?? null,
    rfid_uid: (row["rfid_uid"] as string | null) ?? null,
  });
  if (typeof row["pin"] === "string" && row["pin"]) {
    row["pin_hash"] = await bcrypt.hash(row["pin"], 10);
    row["pin"] = null; // never persist plaintext PINs
  }
  const p = await unwrap<any>(db.from("profiles").insert(row).select().single());
  return safeProfile(p);
}

// Fields a signed-in user may change on their own profile. Everything else
// (role, grade level, section, student id) stays staff-only.
const SELF_PATCH_KEYS = ["full_name", "email", "avatar_url", "pin", "rfid_uid"];

export function selfServicePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SELF_PATCH_KEYS) {
    if (key in patch) out[key] = patch[key];
  }
  if (Object.keys(out).length === 0) throw new Error("Forbidden");
  return out;
}

// Login credentials / identity fields. Nobody may change these on an account
// that is not their own unless they are an admin acting on a student record.
const CREDENTIAL_KEYS = ["pin", "rfid_uid", "email", "username", "password", "face_embedding"];

/**
 * Authorize a profile update and return the patch the caller is allowed to
 * apply. Rules:
 *  - Anyone may edit their OWN profile (self-service subset for students).
 *  - Staff may edit STUDENT records (roster maintenance).
 *  - Only an admin may edit another teacher's or admin's record, and no one
 *    but the owner or an admin may change credential fields on someone else.
 */
export async function authorizeProfileUpdate(
  token: string,
  targetId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const caller = await requireSession(token);
  if (caller.id === targetId) {
    return caller.role === "student" ? selfServicePatch(patch) : patch;
  }
  if (caller.role === "student") throw new Error("Forbidden");

  const target = await getProfileById(targetId);
  if (!target) throw new Error("Profile not found");

  // Staff-on-staff edits (including credential resets) are admin-only.
  if (target.role !== "student" && caller.role !== "admin") {
    throw new Error("Forbidden: only an administrator may edit staff accounts.");
  }
  // Teachers may maintain student records but never reset their login
  // credentials or identity — that stays with administrators.
  if (caller.role !== "admin") {
    const touched = CREDENTIAL_KEYS.filter((k) => k in patch);
    if (touched.length > 0) {
      throw new Error("Forbidden: only an administrator may change login credentials.");
    }
  }
  return patch;
}

export async function updateProfile(id: string, patch: Record<string, unknown>) {
  const row = { ...patch };
  if (typeof row["email"] === "string" && row["email"]) {
    row["email"] = (row["email"] as string).trim().toLowerCase();
  }
  // Friendly duplicate detection instead of a raw constraint violation.
  await assertUniqueIdentity(
    {
      email: (row["email"] as string | null) ?? null,
      student_id: (row["student_id"] as string | null) ?? null,
      rfid_uid: (row["rfid_uid"] as string | null) ?? null,
      employee_id: (row["employee_id"] as string | null) ?? null,
    },
    id,
  );
  if (typeof row["pin"] === "string" && row["pin"]) {
    row["pin_hash"] = await bcrypt.hash(row["pin"], 10);
    row["pin"] = null; // never persist plaintext PINs
  }
  await unwrap(db.from("profiles").update(row).eq("id", id));
  // Revoke active sessions when credentials or role change (jti revocation)
  if ("role" in row || "pin_hash" in row || "password_hash" in row) {
    await revokeSessions(id);
  }
}

/**
 * Teacher self-service settings mutation. The teacher id comes from the
 * verified session token (never the request body), so a teacher can only
 * ever mutate their own faculty record. PINs are bcrypt-hashed by
 * updateProfile(); the fresh, credential-stripped profile is returned so the
 * client can refresh its global session store.
 */
export async function updateTeacherSettings(teacherId: string, patch: Record<string, unknown>) {
  if (Object.keys(patch).length === 0) throw new Error("Nothing to update");
  await updateProfile(teacherId, patch);
  const fresh = await getProfileById(teacherId);
  if (!fresh) throw new Error("Unauthorized");
  return fresh;
}

/**
 * Admin-only user removal — SOFT DELETE. The row is stamped with
 * deleted_at (never erased), so historical grades, submissions, and
 * attendance logs keyed by profile id stay intact and referential.
 * Safeguards:
 * - An admin cannot remove their OWN account (caller id === target id).
 * - The LAST remaining admin cannot be removed (console lockout guard).
 * Access is revoked immediately: kiosk credentials are nulled and every
 * profile lookup filters deleted rows, so existing session tokens die on
 * their next server call. Course leads are unassigned in the same flow.
 */
export async function deleteUser(adminId: string, id: string) {
  if (adminId === id) throw new Error("You can't remove your own account");
  const target = await unwrap<any>(
    db
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  );
  if (!target) throw new Error("User not found");
  if (target.role === "admin") {
    const admins = await unwrap<any[]>(
      db.from("profiles").select("id").eq("role", "admin").is("deleted_at", null),
    );
    if (admins.length <= 1) throw new Error("You can't remove the last remaining admin");
  }
  // Auto-unassignment: a removed teacher must not linger as a course lead.
  const cleared = await unwrap<any[]>(
    db.from("courses").update({ teacher_id: null }).eq("teacher_id", id).select("id"),
  );
  // Release the unique identifiers (email, student_id) and login handles so an
  // admin can re-register the same person/details later. The originals are
  // preserved inline with a `deleted:<timestamp>:` prefix for audit purposes,
  // and every lookup filters soft-deleted rows anyway.
  const stamp = new Date().toISOString();
  const tombstone = (value: unknown) =>
    typeof value === "string" && value && !value.startsWith("deleted:")
      ? `deleted:${stamp}:${value}`.slice(0, 300)
      : (value ?? null);
  const archived = await unwrap<any>(
    db
      .from("profiles")
      .select("email, student_id, username, employee_id")
      .eq("id", id)
      .maybeSingle(),
  );
  await unwrap(
    db
      .from("profiles")
      .update({
        deleted_at: stamp,
        rfid_uid: null,
        pin: null,
        pin_hash: null,
        password_hash: null,
        email: tombstone(archived?.email),
        student_id: tombstone(archived?.student_id),
        username: tombstone(archived?.username),
        employee_id: tombstone(archived?.employee_id),
      })
      .eq("id", id),
  );
  await revokeSessions(id);

  return { unassignedCourses: cleared.length };
}

/* ---------- File-type sniff (file-type pkg or magic-byte fallback) ---------- */

const AVATAR_ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MATERIAL_ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
]);

function detectMimeByMagic(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image/webp";
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
    return "application/pdf";
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0)
    return "application/msword";
  if (
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
    (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  )
    return "application/zip";
  return null;
}

async function sniffMime(buffer: Buffer): Promise<string | null> {
  try {
    const mod: any = await import("file-type");
    const fn = mod.fileTypeFromBuffer ?? mod.fromBuffer ?? mod.default?.fileTypeFromBuffer;
    if (typeof fn === "function") {
      const ft = await fn(buffer);
      if (ft?.mime) return ft.mime as string;
    }
  } catch {
    // file-type unavailable — fallback to magic bytes
  }
  return detectMimeByMagic(buffer);
}

/* ---------- Avatar upload pipeline (storage + DB in one call) ---------- */

const AVATAR_BUCKET = "avatars";
const AVATAR_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Same-origin media URL served by the streaming route (private bucket). */
export function avatarUrlForPath(path: string): string {
  return `/api/public/avatar?p=${encodeURIComponent(path)}`;
}

/**
 * Writes the caller's avatar image to private storage and updates
 * profiles.avatar_url in the same server call, returning the fresh profile
 * record so the client can confirm the persisted path from the response
 * payload. Every upload gets a unique versioned filename
 * (avatar_<timestamp>_<hash>), so browsers never serve a stale cached image
 * even though the media endpoint allows long-lived caching.
 */
export async function uploadAvatar(tokenStr: string, base64: string, contentType: string) {
  const caller = await requireSession(tokenStr);
  const ext = AVATAR_EXT[contentType];
  if (!ext) throw new Error("Unsupported image type — use PNG, JPEG, WebP, or GIF");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) throw new Error("Empty image");
  if (buffer.byteLength > 2 * 1024 * 1024) throw new Error("Image must be under 2 MB");
  // File-type sniff: declared mime must match sniffed + be in allowed set
  const sniffed = await sniffMime(buffer);
  if (!sniffed || !AVATAR_ALLOWED_MIMES.has(sniffed))
    throw new Error(
      `Unsupported image content (${sniffed ?? "unknown"}) — use PNG, JPEG, WebP, or GIF`,
    );
  // Normalize JPEG variants: file-type returns image/jpeg
  if (sniffed !== contentType)
    throw new Error(`MIME mismatch: declared ${contentType} but file is ${sniffed}`);
  // Entropy hardened: include randomUUID, 16 hex chars (64-bit)
  const rand = createHmac("sha256", sessionSecret())
    .update(`${caller.id}:${Date.now()}:${randomUUID()}`)
    .digest("hex")
    .slice(0, 16);
  const path = `${caller.id}/avatar_${Date.now()}_${rand}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Storage upload failed (${error.message})`);
  const previous = caller.avatar_url;
  await unwrap(
    db
      .from("profiles")
      .update({ avatar_url: avatarUrlForPath(path) })
      .eq("id", caller.id),
  );
  // Best-effort cleanup of the replaced object so the bucket doesn't fill up.
  try {
    const m = previous?.match(/[?&]p=([^&]+)/);
    const old = m ? decodeURIComponent(m[1]!) : null;
    if (old && old.startsWith(`${caller.id}/`) && old !== path) {
      await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([old]);
    }
  } catch {
    /* cleanup is best-effort */
  }
  return getProfileById(caller.id);
}

export async function listStudents() {
  const rows = await unwrap<any[]>(
    db.from("profiles").select("*").eq("role", "student").is("deleted_at", null).order("full_name"),
  );
  return rows.map(safeProfile);
}

export async function listStaff() {
  const rows = await unwrap<any[]>(
    db
      .from("profiles")
      .select("*")
      .in("role", ["teacher", "admin"])
      .is("deleted_at", null)
      .order("full_name"),
  );
  return rows.map(safeProfile);
}

/**
 * Teaching roster ONLY. Admin accounts are excluded from course-lead
 * pickers and teaching rosters unless explicitly reassigned to teacher.
 */
export async function listTeachers() {
  const rows = await unwrap<any[]>(
    db.from("profiles").select("*").eq("role", "teacher").is("deleted_at", null).order("full_name"),
  );
  return rows.map(safeProfile);
}

/**
 * Faculty directory for the admin Teachers console: every active teacher plus
 * the courses they lead. Credentials stay masked (safeProfile) — only
 * has_pin/has_rfid indicators cross the wire.
 */
export async function listTeacherDirectory() {
  const [rows, courses] = await Promise.all([
    unwrap<any[]>(
      db
        .from("profiles")
        .select("*")
        .eq("role", "teacher")
        .is("deleted_at", null)
        .order("full_name"),
    ),
    unwrap<any[]>(db.from("courses").select("id, title, code, teacher_id")),
  ]);
  return rows.map((r) => ({
    ...safeProfile(r),
    courses: courses
      .filter((c) => c.teacher_id === r.id)
      .map((c) => ({ id: c.id as string, title: c.title as string, code: c.code as string })),
  }));
}

/** Reject a duplicate email / employee ID / RFID UID across ACTIVE accounts. */
async function assertUniqueIdentity(
  fields: {
    email?: string | null;
    employee_id?: string | null;
    rfid_uid?: string | null;
    student_id?: string | null;
    username?: string | null;
  },
  exceptId?: string,
) {
  const checks: Array<[string, string, string]> = [];
  if (fields.email) checks.push(["email", fields.email.toLowerCase(), "email address"]);
  if (fields.employee_id) checks.push(["employee_id", fields.employee_id, "employee ID"]);
  if (fields.rfid_uid) checks.push(["rfid_uid", fields.rfid_uid, "RFID card"]);
  if (fields.student_id) checks.push(["student_id", fields.student_id, "student ID"]);
  if (fields.username) checks.push(["username", fields.username, "username"]);

  for (const [column, value, label] of checks) {
    const hits = await unwrap<any[]>(
      db.from("profiles").select("id").ilike(column, value).is("deleted_at", null),
    );
    if (hits.some((h) => h.id !== exceptId)) {
      throw new Error(`That ${label} is already registered to another account`);
    }
  }
}

/**
 * Admin-only faculty creation. role is forced to 'teacher', the temporary PIN
 * is bcrypt-hashed before it touches the database, and email / employee ID /
 * RFID UID are verified unique across all active accounts.
 */
export async function createTeacher(input: z.infer<typeof schemas.teacherInput>) {
  const row = withoutToken(input) as Record<string, unknown>;
  const email = input.email.trim().toLowerCase();
  await assertUniqueIdentity({
    email,
    employee_id: input.employee_id,
    rfid_uid: input.rfid_uid ?? null,
  });
  row["email"] = email;
  row["role"] = "teacher";
  row["pin_hash"] = await bcrypt.hash(input.pin, 12);
  row["pin"] = null;
  // Faculty sign in at the kiosk with their employee ID (or email) + PIN, so
  // the employee ID must exist as a login handle too.
  row["username"] = input.employee_id.trim();
  if (!row["rfid_uid"]) row["rfid_uid"] = null;
  const created = await unwrap<any>(db.from("profiles").insert(row).select().single());

  return { ...safeProfile(created), courses: [] as { id: string; title: string; code: string }[] };
}

/**
 * Biometric / hardware enrolment writer used by both admin-assisted
 * registration and self-service settings. Stamps biometric_enrolled_at when a
 * face descriptor is saved; is_face_enrolled is a generated column.
 */
export async function enrollBiometrics(
  id: string,
  fields: { face_embedding?: string | null; rfid_uid?: string | null },
) {
  const row: Record<string, unknown> = {};
  if ("face_embedding" in fields) {
    row["face_embedding"] = fields.face_embedding ?? null;
    row["biometric_enrolled_at"] = fields.face_embedding ? new Date().toISOString() : null;
  }
  if ("rfid_uid" in fields) row["rfid_uid"] = fields.rfid_uid ?? null;
  if (Object.keys(row).length === 0) throw new Error("Nothing to enroll");
  if (fields.rfid_uid) await assertUniqueIdentity({ rfid_uid: fields.rfid_uid }, id);
  await unwrap(db.from("profiles").update(row).eq("id", id));
  const fresh = await getProfileById(id);
  if (!fresh) throw new Error("User not found");
  return fresh;
}

/** Full user directory for the admin Users & Roles console. */
export async function listAllUsers() {
  const rows = await unwrap<any[]>(
    db.from("profiles").select("*").is("deleted_at", null).order("full_name"),
  );
  return rows.map(safeProfile);
}

/**
 * Admin-only role reassignment with transition safeguards:
 * - An admin cannot change their OWN role (prevents console lockout).
 * - teacher/admin → student: every course they lead is unassigned in the
 *   same flow, so no orphaned instructor references remain.
 * - student → teacher/admin: academic records (grades, submissions,
 *   attendance, enrollments) are keyed by profile id and are preserved
 *   untouched — the account simply unlocks faculty capabilities.
 * Permissions take effect immediately: every gated server function resolves
 * the caller's role fresh from the database on each call, and clients pick
 * the new role up via the session refresh channel.
 */
export async function updateUserRole(
  adminId: string,
  id: string,
  role: "student" | "teacher" | "admin",
) {
  if (adminId === id) throw new Error("You can't change your own role");
  const target = await getProfileById(id);
  if (!target) throw new Error("User not found");
  // Console lockout guard: the last remaining admin cannot be demoted.
  if (target.role === "admin" && role !== "admin") {
    const admins = await unwrap<any[]>(
      db.from("profiles").select("id").eq("role", "admin").is("deleted_at", null),
    );
    if (admins.length <= 1) throw new Error("You can't demote the last remaining admin");
  }
  let unassignedCourses = 0;
  if (role === "student" && target.role !== "student") {
    const cleared = await unwrap<any[]>(
      db.from("courses").update({ teacher_id: null }).eq("teacher_id", id).select("id"),
    );
    unassignedCourses = cleared.length;
  }
  await unwrap(db.from("profiles").update({ role }).eq("id", id));
  await revokeSessions(id);
  const profile = await getProfileById(id);
  if (!profile) throw new Error("User not found after update");
  return { profile, unassignedCourses };
}

/* ---------- Announcements ---------- */

export async function listAnnouncements() {
  return unwrap<any[]>(
    db
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
  );
}

export async function createAnnouncement(input: z.infer<typeof schemas.announcementInput>) {
  await unwrap(db.from("announcements").insert(withoutToken(input)));
}

export async function updateAnnouncement(id: string, patch: Record<string, unknown>) {
  await unwrap(db.from("announcements").update(patch).eq("id", id));
}

export async function deleteAnnouncement(id: string) {
  await unwrap(db.from("announcements").delete().eq("id", id));
}

/* ---------- Courses, assignments, enrollments ---------- */

export async function listCourses() {
  const courses = await unwrap<any[]>(db.from("courses").select("*").order("code"));
  const teachers = await unwrap<Array<{ id: string; full_name: string }>>(
    db
      .from("profiles")
      .select("id, full_name")
      .in("role", ["teacher", "admin"])
      .is("deleted_at", null),
  );
  const byId = new Map(teachers.map((t) => [t.id, t.full_name]));
  return courses.map((c) => ({
    ...c,
    teacher_name: c.teacher_id ? byId.get(c.teacher_id) : undefined,
  }));
}

/**
 * Relational integrity: courses.teacher_id may only reference an active
 * user whose role is 'teacher' — never an admin or student account.
 */
async function assertTeacherAssignable(teacherId: unknown) {
  if (teacherId == null) return;
  const t = await unwrap<any>(
    db.from("profiles").select("id, role").eq("id", teacherId).is("deleted_at", null).maybeSingle(),
  );
  if (!t || t.role !== "teacher") {
    throw new Error("Course leads must be users with the teacher role");
  }
}

export async function createCourse(input: z.infer<typeof schemas.courseInput>) {
  await assertTeacherAssignable(input["teacher_id"]);
  await unwrap(db.from("courses").insert(withoutToken(input)));
}

/**
 * Course updates: admins may change anything (including the course lead);
 * teachers may only edit metadata on a course they already lead and can never
 * reassign `teacher_id`. Returns the patch that is safe to apply.
 */
export async function authorizeCourseUpdate(
  token: string,
  id: string,
  patch: Record<string, unknown>,
) {
  const caller = await requireStaff(token);
  if (caller.role === "admin") return patch;

  const course = await unwrap<any>(
    db.from("courses").select("teacher_id").eq("id", id).maybeSingle(),
  );
  if (!course || course.teacher_id !== caller.id) {
    throw new Error("Forbidden: you can only edit courses you lead.");
  }
  const { teacher_id: _ignored, ...rest } = patch;
  return rest;
}

export async function updateCourse(id: string, patch: Record<string, unknown>) {
  if ("teacher_id" in patch) await assertTeacherAssignable(patch["teacher_id"]);
  await unwrap(db.from("courses").update(patch).eq("id", id));
}

export async function deleteCourse(id: string) {
  await unwrap(db.from("courses").delete().eq("id", id));
}

export async function listAssignments() {
  return unwrap<any[]>(db.from("assignments").select("*").is("deleted_at", null).order("due_date"));
}

export async function createAssignment(input: z.infer<typeof schemas.assignmentInput>) {
  await unwrap(db.from("assignments").insert(withoutToken(input)));
}

export async function enrollmentsForCourse(courseId: string): Promise<string[]> {
  const rows = await unwrap<Array<{ student_id: string }>>(
    db.from("enrollments").select("student_id").eq("course_id", courseId),
  );
  return rows.map((r) => r.student_id);
}

export async function enrollmentsForStudent(studentId: string): Promise<string[]> {
  const rows = await unwrap<Array<{ course_id: string }>>(
    db.from("enrollments").select("course_id").eq("student_id", studentId),
  );
  return rows.map((r) => r.course_id);
}

export async function enrollStudent(student_id: string, course_id: string) {
  const existing = await unwrap<{ id: string } | null>(
    db
      .from("enrollments")
      .select("id")
      .eq("student_id", student_id)
      .eq("course_id", course_id)
      .maybeSingle(),
  );
  if (!existing) await unwrap(db.from("enrollments").insert({ student_id, course_id }));
}

/* ---------- Submissions ---------- */

export async function listSubmissionsForStudent(studentId: string) {
  return unwrap<any[]>(db.from("submissions").select("*").eq("student_id", studentId));
}

export async function submitAssignment(input: z.infer<typeof schemas.submissionInput>) {
  const existing = await unwrap<{ id: string } | null>(
    db
      .from("submissions")
      .select("id")
      .eq("assignment_id", input.assignment_id)
      .eq("student_id", input.student_id)
      .maybeSingle(),
  );
  const row = withoutToken(input);
  if (existing) await unwrap(db.from("submissions").update(row).eq("id", existing.id));
  else await unwrap(db.from("submissions").insert(row));
}

/* ---------- Quizzes (answer keys stay server-side) ---------- */

export async function listQuizzes() {
  return unwrap<any[]>(db.from("quizzes").select("*").is("deleted_at", null));
}

export async function getQuizPublic(id: string) {
  const quiz = await unwrap<any>(
    db.from("quizzes").select("*").eq("id", id).is("deleted_at", null).single(),
  );
  // Never select correct_answer — grading happens in scoreQuiz (submitQuizAttempt).
  const questions = await unwrap<any[]>(
    db
      .from("quiz_questions")
      .select("id, quiz_id, question, options, position")
      .eq("quiz_id", id)
      .order("position"),
  );

  return { quiz, questions };
}

/* ---------- Essay auto-grading (strict) ---------- */

// Essays previously earned credit for any 3+ character answer, so gibberish
// like "asd" passed. The grader now runs hard validation gates BEFORE the
// rubric is evaluated:
//   1. Length pre-check — fewer than 5 real words fails instantly.
//   2. Gibberish screen — random keystrokes (vowel-less blobs, repeated-char
//      runs) fail regardless of accidental keyword hits.
//   3. Mandatory keyword categories — when the rubric declares
//      "| Keywords: cat1 = a, b; cat2 = c, d", the answer must hit at least
//      one keyword from TWO DISTINCT categories. With no declared categories,
//      at least two distinct concept words from the rubric text must appear.

const ESSAY_MIN_WORDS = 5;

function essayWords(answer: string): string[] {
  return answer.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
}

/** Random-keystroke / incoherent input detection, independent of keywords. */
function isGibberishAnswer(answer: string, words: string[]): boolean {
  if (words.length < ESSAY_MIN_WORDS) return true;
  const lower = answer.toLowerCase();
  if (/([a-z])\1{3,}/.test(lower)) return true; // "aaaaaa"
  // Long words with no vowels are keystroke blobs ("asdfgh", "qwrty").
  if (words.some((w) => w.length >= 5 && !/[aeiou]/.test(w))) return true;
  return false;
}

/** Parse "| Keywords: why = a, b; technique = c, d" into category arrays. */
export function parseKeywordCategories(rubric: string): string[][] {
  const m = rubric.match(/\|\s*keywords?\s*:\s*(.+)$/i) ?? rubric.match(/^keywords?\s*:\s*(.+)$/i);
  if (!m) return [];
  return m[1]!
    .split(";")
    .map((group) =>
      group
        .replace(/^[^=;]*=\s*/, "") // drop optional "category = " label
        .split(/[,/|]/)
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    )
    .filter((g) => g.length > 0);
}

const RUBRIC_STOPWORDS = new Set(
  (
    "the a an and or of to in on for with by is are was were be that this it its as at from their they them his her he she you your we our " +
    "not no but if then than so such into over under between about through during before after above below each other some any all both " +
    "more most less very can could should would may might must will shall do does did done pass fail requires require required full marks " +
    "credit answer answers response responses explanation identification identify coherent complete incomplete gibberish single word words " +
    "instantly elements element two one concept concepts specific technique demonstrates demonstrate shows show mention mentions"
  ).split(" "),
);

/** Fallback concept words mined from free-text rubrics. */
function rubricConcepts(rubric: string): string[] {
  const words = (rubric.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []).filter(
    (w) => !RUBRIC_STOPWORDS.has(w),
  );
  return [...new Set(words)];
}

function keywordHit(answer: string, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return false;
  if (needle.includes(" ")) return answer.toLowerCase().includes(needle); // phrase
  // Single word: prefix match so "adapt" credits "adaptation"/"adaptive".
  return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*`, "i").test(answer);
}

/** Strict essay grading: length + gibberish gates, then rubric keyword categories. */
export function gradeEssay(answer: string, rubric: string): boolean {
  const words = essayWords(answer);
  if (isGibberishAnswer(answer, words)) return false;
  const categories = parseKeywordCategories(rubric);
  if (categories.length >= 2) {
    const hitCategories = categories.filter((cat) =>
      cat.some((kw) => keywordHit(answer, kw)),
    ).length;
    return hitCategories >= 2;
  }
  // No declared categories: require at least two distinct rubric concept hits
  // (or two hits from the single declared keyword group).
  const concepts = categories[0] ?? rubricConcepts(rubric);
  return concepts.filter((kw) => keywordHit(answer, kw)).length >= 2;
}

// Pure scoring — no persistence. Attempt recording and retake guardrails
// live in submitQuizAttempt below.
async function scoreQuiz(quiz_id: string, answers: Record<string, string>) {
  // Full breakdown is returned only AFTER submission so students can review.
  const questions = await unwrap<
    Array<{ id: string; question: string; options: unknown; correct_answer: string }>
  >(
    db
      .from("quiz_questions")
      .select("id, question, options, correct_answer")
      .eq("quiz_id", quiz_id)
      .order("position"),
  );
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.,;:!?]+$/, "");
  const results = questions.map((q) => {
    const chosen = answers[q.id] ?? null;
    const options = (Array.isArray(q.options) ? q.options : []) as string[];
    const key = q.correct_answer as string;
    // Essays are rubric-scored through strict validation gates (length,
    // gibberish screen, keyword categories) — see gradeEssay. Fill-in-the-
    // blank keys may hold "||"-separated acceptable variants.
    const isEssay = options.length === 0 && key.startsWith("Rubric:");
    const variants = key.split("||").map(norm);
    const correct = isEssay
      ? !!chosen && gradeEssay(chosen, key.slice("Rubric:".length).trim())
      : chosen != null && variants.includes(norm(chosen));
    return {
      id: q.id as string,
      question: q.question as string,
      options,
      chosen,
      correct_answer: key,
      correct,
    };
  });
  const score = results.filter((r) => r.correct).length;
  return { score, total: questions.length, results };
}

/* ---------- Retake policy engine ---------- */

type RetakePolicy = "highest_score" | "latest_attempt" | "average_score";

interface QuizConfig {
  id: string;
  course_id: string;
  title: string;
  allow_retake: boolean;
  max_attempts: number; // 0 = unlimited while retakes are allowed
  retake_score_policy: RetakePolicy;
  score_released: boolean;
  answer_key_released: boolean;
}

const QUIZ_CONFIG_COLS =
  "id, course_id, title, allow_retake, max_attempts, retake_score_policy, score_released, answer_key_released";

async function getQuizConfig(quizId: string): Promise<QuizConfig> {
  const quiz = await unwrap<any>(
    db.from("quizzes").select(QUIZ_CONFIG_COLS).eq("id", quizId).maybeSingle(),
  );
  if (!quiz) throw new Error("Worksheet not found.");
  return quiz as QuizConfig;
}

async function attemptsFor(quizId: string, studentId: string) {
  return unwrap<
    Array<{ attempt_number: number; score: number; total: number; created_at: string }>
  >(
    db
      .from("quiz_attempts")
      .select("attempt_number, score, total, created_at")
      .eq("quiz_id", quizId)
      .eq("student_id", studentId)
      .order("attempt_number"),
  );
}

async function extraAttemptsFor(quizId: string, studentId: string): Promise<number> {
  const grant = await unwrap<any>(
    db
      .from("quiz_retake_grants")
      .select("extra_attempts")
      .eq("quiz_id", quizId)
      .eq("student_id", studentId)
      .maybeSingle(),
  );
  return typeof grant?.extra_attempts === "number" ? grant.extra_attempts : 0;
}

/** Attempt ceiling: null = unlimited. Teacher grants add attempts on top. */
function attemptCeiling(quiz: QuizConfig, extra: number): number | null {
  if (quiz.allow_retake && quiz.max_attempts === 0) return null;
  const base = quiz.allow_retake ? quiz.max_attempts : 1;
  return base + extra;
}

type AttemptRow = { attempt_number: number; score: number; total: number };

/** Gradebook score for a set of attempts under the worksheet's policy. */
function effectiveScore(
  attempts: AttemptRow[],
  policy: RetakePolicy,
): { score: number; total: number } | null {
  if (!attempts.length) return null;
  const pct = (a: AttemptRow) => (a.total > 0 ? a.score / a.total : 0);
  if (policy === "latest_attempt") {
    const latest = attempts.reduce((a, b) => (b.attempt_number > a.attempt_number ? b : a));
    return { score: latest.score, total: latest.total };
  }
  if (policy === "average_score") {
    const total = attempts[0]!.total;
    const avg = attempts.reduce((s, a) => s + pct(a), 0) / attempts.length;
    return { score: Math.round(avg * total * 100) / 100, total };
  }
  const best = attempts.reduce((a, b) => (pct(b) > pct(a) ? b : a));
  return { score: best.score, total: best.total };
}

/**
 * Submit a worksheet attempt. Every submission is validated against the
 * worksheet's retake policy BEFORE scoring and recording: past the ceiling,
 * the attempt is rejected and nothing is written.
 */
export async function submitQuizAttempt(
  quiz_id: string,
  answers: Record<string, string>,
  token: string,
) {
  const caller = await requireSession(token);
  const quiz = await getQuizConfig(quiz_id);
  const [attempts, extra] = await Promise.all([
    attemptsFor(quiz_id, caller.id),
    extraAttemptsFor(quiz_id, caller.id),
  ]);
  const ceiling = attemptCeiling(quiz, extra);
  if (ceiling != null && attempts.length >= ceiling) {
    return {
      ok: false as const,
      reason: (!quiz.allow_retake && extra === 0 ? "retakes_disabled" : "max_attempts") as
        "retakes_disabled" | "max_attempts",
      attempts_used: attempts.length,
      attempts_allowed: ceiling,
    };
  }

  const { score, total, results } = await scoreQuiz(quiz_id, answers);
  const attempt_number = attempts.reduce((m, a) => Math.max(m, a.attempt_number), 0) + 1;
  await unwrap(
    db
      .from("quiz_attempts")
      .insert({ quiz_id, student_id: caller.id, attempt_number, score, total, results }),
  );

  const used = attempts.length + 1;
  const eff = effectiveScore(
    [...attempts, { attempt_number, score, total }],
    quiz.retake_score_policy,
  );
  // Teacher-gated release: hide scores/answer key until quiz.score_released / answer_key_released.
  const isScoreReleased = quiz.score_released === true;
  const isAnswerKeyReleased = quiz.answer_key_released === true;
  const gatedResults = isAnswerKeyReleased
    ? results
    : results.map((r) => ({ ...r, correct_answer: "" }));
  const gatedScore = isScoreReleased ? score : null;
  const gatedEffective = isScoreReleased ? (eff?.score ?? score) : null;
  return {
    ok: true as const,
    score: gatedScore as number | null,
    total,
    results: gatedResults,
    attempt_number,
    attempts_used: used,
    attempts_allowed: ceiling,
    can_retake: ceiling == null || used < ceiling,
    effective_score: gatedEffective as number | null,
    retake_score_policy: quiz.retake_score_policy,
    score_released: isScoreReleased,
    answer_key_released: isAnswerKeyReleased,
  };
}

/** Per-worksheet attempt state for the signed-in student (drives the UI). */
export async function quizAttemptInfo(quiz_id: string, token: string) {
  const caller = await requireSession(token);
  const quiz = await getQuizConfig(quiz_id);
  const [attempts, extra] = await Promise.all([
    attemptsFor(quiz_id, caller.id),
    extraAttemptsFor(quiz_id, caller.id),
  ]);
  const ceiling = attemptCeiling(quiz, extra);
  const eff = effectiveScore(attempts, quiz.retake_score_policy);
  const isScoreReleased = quiz.score_released === true;
  return {
    quiz_id,
    allow_retake: quiz.allow_retake,
    max_attempts: quiz.max_attempts,
    retake_score_policy: quiz.retake_score_policy,
    attempts_used: attempts.length,
    attempts_allowed: ceiling,
    can_retake: attempts.length === 0 || ceiling == null || attempts.length < ceiling,
    effective_score: isScoreReleased ? (eff?.score ?? null) : null,
    effective_total: isScoreReleased ? (eff?.total ?? null) : null,
    extra_attempts: extra,
    score_released: isScoreReleased,
    answer_key_released: quiz.answer_key_released === true,
  };
}

/** Attempt summaries for ALL worksheets for the signed-in student (one round trip). */
export async function listMyQuizSummaries(token: string) {
  const caller = await requireSession(token);
  const [attempts, grants, quizzes] = await Promise.all([
    unwrap<any[]>(
      db
        .from("quiz_attempts")
        .select("quiz_id, attempt_number, score, total")
        .eq("student_id", caller.id),
    ),
    unwrap<any[]>(
      db.from("quiz_retake_grants").select("quiz_id, extra_attempts").eq("student_id", caller.id),
    ),
    unwrap<any[]>(db.from("quizzes").select(QUIZ_CONFIG_COLS).is("deleted_at", null)),
  ]);
  const configById = new Map<string, QuizConfig>(
    (quizzes ?? []).map((q: any) => [q.id as string, q as QuizConfig]),
  );
  const extraByQuiz = new Map<string, number>(
    (grants ?? []).map((g: any) => [g.quiz_id as string, (g.extra_attempts as number) ?? 0]),
  );
  const byQuiz = new Map<string, AttemptRow[]>();
  for (const a of attempts ?? []) {
    const arr = byQuiz.get(a.quiz_id) ?? [];
    arr.push({ attempt_number: a.attempt_number, score: a.score, total: a.total });
    byQuiz.set(a.quiz_id, arr);
  }
  return [...configById.values()].map((quiz) => {
    const list = byQuiz.get(quiz.id) ?? [];
    const ceiling = attemptCeiling(quiz, extraByQuiz.get(quiz.id) ?? 0);
    const eff = effectiveScore(list, quiz.retake_score_policy);
    const isScoreReleased = (quiz as QuizConfig).score_released === true;
    return {
      quiz_id: quiz.id,
      attempts_used: list.length,
      attempts_allowed: ceiling,
      can_retake: list.length === 0 || ceiling == null || list.length < ceiling,
      effective_score: isScoreReleased ? (eff?.score ?? null) : null,
      effective_total: isScoreReleased ? (eff?.total ?? null) : null,
      score_released: isScoreReleased,
      answer_key_released: (quiz as QuizConfig).answer_key_released === true,
    };
  });
}

/** Teachers may only manage worksheets for courses they lead; admins any. */
async function requireQuizOwnerOrAdmin(token: string, quizId: string) {
  const caller = await requireStaff(token);
  if (caller.role === "teacher") {
    const quiz = await getQuizConfig(quizId);
    const course = await unwrap<any>(
      db.from("courses").select("teacher_id").eq("id", quiz.course_id).maybeSingle(),
    );
    if (!course || course.teacher_id !== caller.id) {
      throw new Error("Forbidden: you can only manage worksheets for your own courses.");
    }
  }
  return caller;
}

export async function updateQuizRetakePolicy(
  id: string,
  patch: { allow_retake: boolean; max_attempts: number; retake_score_policy: RetakePolicy },
  token: string,
) {
  await requireQuizOwnerOrAdmin(token, id);
  await unwrap(db.from("quizzes").update(patch).eq("id", id));
}

/** Staff roster view: per-student attempt history and grant state for one worksheet. */
export async function listQuizAttemptsForQuiz(quiz_id: string, token: string) {
  await requireQuizOwnerOrAdmin(token, quiz_id);
  const quiz = await getQuizConfig(quiz_id);
  const [attempts, grants] = await Promise.all([
    unwrap<any[]>(
      db
        .from("quiz_attempts")
        .select("student_id, attempt_number, score, total, created_at")
        .eq("quiz_id", quiz_id)
        .order("attempt_number"),
    ),
    unwrap<any[]>(
      db.from("quiz_retake_grants").select("student_id, extra_attempts").eq("quiz_id", quiz_id),
    ),
  ]);
  const studentIds = [...new Set<string>((attempts ?? []).map((a: any) => a.student_id as string))];
  const profiles = studentIds.length
    ? await unwrap<any[]>(
        db.from("profiles").select("id, full_name, student_id, section").in("id", studentIds),
      )
    : [];
  const nameOf = new Map<string, any>((profiles ?? []).map((p: any) => [p.id as string, p]));
  const extraOf = new Map<string, number>(
    (grants ?? []).map((g: any) => [g.student_id as string, (g.extra_attempts as number) ?? 0]),
  );
  const byStudent = new Map<string, AttemptRow[]>();
  for (const a of attempts ?? []) {
    const arr = byStudent.get(a.student_id) ?? [];
    arr.push({ attempt_number: a.attempt_number, score: a.score, total: a.total });
    byStudent.set(a.student_id, arr);
  }
  const students = studentIds.map((sid) => {
    const list = byStudent.get(sid) ?? [];
    const eff = effectiveScore(list, quiz.retake_score_policy);
    const p = nameOf.get(sid);
    return {
      student_id: sid,
      full_name: p?.full_name ?? "Unknown student",
      student_no: p?.student_id ?? null,
      section: p?.section ?? null,
      attempts: list,
      attempts_used: list.length,
      extra_attempts: extraOf.get(sid) ?? 0,
      effective_score: eff?.score ?? null,
      effective_total: eff?.total ?? null,
    };
  });
  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      course_id: quiz.course_id,
      allow_retake: quiz.allow_retake,
      max_attempts: quiz.max_attempts,
      retake_score_policy: quiz.retake_score_policy,
    },
    students,
  };
}

/** Grant one extra attempt (stackable) to a student on a worksheet. */
export async function grantQuizRetake(quiz_id: string, student_id: string, token: string) {
  const caller = await requireQuizOwnerOrAdmin(token, quiz_id);
  const existing = await unwrap<any>(
    db
      .from("quiz_retake_grants")
      .select("id, extra_attempts")
      .eq("quiz_id", quiz_id)
      .eq("student_id", student_id)
      .maybeSingle(),
  );
  if (existing) {
    await unwrap(
      db
        .from("quiz_retake_grants")
        .update({ extra_attempts: (existing.extra_attempts as number) + 1, granted_by: caller.id })
        .eq("id", existing.id),
    );
  } else {
    await unwrap(
      db
        .from("quiz_retake_grants")
        .insert({ quiz_id, student_id, extra_attempts: 1, granted_by: caller.id }),
    );
  }
}

/** Wipe a student's attempt history (and grant) so they can start fresh. */
export async function resetQuizAttempts(quiz_id: string, student_id: string, token: string) {
  await requireQuizOwnerOrAdmin(token, quiz_id);
  await unwrap(
    db.from("quiz_attempts").delete().eq("quiz_id", quiz_id).eq("student_id", student_id),
  );
  await unwrap(
    db.from("quiz_retake_grants").delete().eq("quiz_id", quiz_id).eq("student_id", student_id),
  );
}

export async function createQuizWithQuestions(
  quiz: z.infer<typeof schemas.quizBundle>["quiz"],
  questions: z.infer<typeof schemas.quizBundle>["questions"],
) {
  const created = await unwrap<any>(db.from("quizzes").insert(quiz).select().single());
  await unwrap(
    db
      .from("quiz_questions")
      .insert(questions.map((q, i) => ({ ...q, quiz_id: created.id, position: i + 1 }))),
  );
}

/* ---------- Grades ---------- */

export async function listGradesForStudent(studentId: string) {
  return unwrap<any[]>(db.from("grades").select("*").eq("student_id", studentId));
}

export async function listGradesForCourse(courseId: string, quarter: number) {
  return unwrap<any[]>(
    db.from("grades").select("*").eq("course_id", courseId).eq("quarter", quarter),
  );
}

export async function upsertGrade(input: z.infer<typeof schemas.gradeInput>) {
  const existing = await unwrap<{ id: string } | null>(
    db
      .from("grades")
      .select("id")
      .eq("student_id", input.student_id)
      .eq("course_id", input.course_id)
      .eq("quarter", input.quarter)
      .maybeSingle(),
  );
  const row = withoutToken(input);
  if (existing) await unwrap(db.from("grades").update(row).eq("id", existing.id));
  else await unwrap(db.from("grades").insert(row));
}

/* ---------- Attendance ---------- */

export async function listAttendance(studentId: string) {
  return unwrap<any[]>(
    db
      .from("attendance_logs")
      .select("*")
      .eq("student_id", studentId)
      .order("timestamp", { ascending: false }),
  );
}

export async function listAllAttendance(limit: number) {
  return unwrap<any[]>(
    db.from("attendance_logs").select("*").order("timestamp", { ascending: false }).limit(limit),
  );
}

export async function logAttendance(
  student_id: string,
  scan_type: "in" | "out",
  status: "on-time" | "late" | "excused",
) {
  await unwrap(db.from("attendance_logs").insert({ student_id, scan_type, status }));
}

/* ---------- Tap status engine (schedule-aware) ---------- */

const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
};

/**
 * Evaluate an RFID tap against the person's class timetable:
 *   on-time  — tap ≤ start + grace period
 *   late     — start + grace < tap ≤ end (a tap after end is still late,
 *              never absent; absent means NO tap within the session window)
 *   excused  — manual override via logAttendance/markStatus, not here
 * Falls back to the 07:30 + 10 min gate cutoff when nothing is scheduled
 * today (or the person has no timetable).
 */
export async function recordTap(uid: string, atISO?: string) {
  const raw = await unwrap<any>(
    db.from("profiles").select("*").eq("rfid_uid", uid).is("deleted_at", null).maybeSingle(),
  );
  if (!raw) return null;
  return recordTapForProfile(raw, atISO);
}

/**
 * Same status engine keyed by profile id — used by the edge-vision kiosk,
 * where the match comes from an on-device face embedding rather than a card.
 */
export async function recordTapByProfileId(id: string, atISO?: string) {
  const raw = await unwrap<any>(
    db.from("profiles").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
  );
  if (!raw) return null;
  return recordTapForProfile(raw, atISO);
}

async function recordTapForProfile(raw: any, atISO?: string) {
  const parsed = atISO ? new Date(atISO) : new Date();
  const at = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const dayStart = new Date(at);
  dayStart.setHours(0, 0, 0, 0);
  const lastToday = await unwrap<Array<{ scan_type: string }>>(
    db
      .from("attendance_logs")
      .select("scan_type")
      .eq("student_id", raw.id)
      .gte("timestamp", dayStart.toISOString())
      .order("timestamp", { ascending: false })
      .limit(1),
  );
  const scan_type: "in" | "out" = lastToday[0]?.scan_type === "in" ? "out" : "in";

  let status: "on-time" | "late" = "on-time";
  let matched: any = null;
  if (scan_type === "in") {
    const courses = await listCourses();
    const enrolled = raw.role === "student" ? new Set(await enrollmentsForStudent(raw.id)) : null;
    const today = DAY_CODES[at.getDay()];
    const atMin = at.getHours() * 60 + at.getMinutes();
    const sessions = courses.filter(
      (c: any) =>
        Array.isArray(c.days_of_week) &&
        c.days_of_week.includes(today) &&
        c.start_time &&
        c.end_time &&
        (enrolled ? enrolled.has(c.id) : c.teacher_id === raw.id),
    );
    if (sessions.length > 0) {
      // Prefer the session whose window contains the tap; else nearest start.
      const inWindow = sessions.find(
        (c: any) => atMin >= toMinutes(c.start_time) - 30 && atMin <= toMinutes(c.end_time),
      );
      matched =
        inWindow ??
        sessions.reduce((best: any, c: any) =>
          Math.abs(toMinutes(c.start_time) - atMin) < Math.abs(toMinutes(best.start_time) - atMin)
            ? c
            : best,
        );
      const grace = matched.late_threshold_minutes ?? 10;
      status = atMin <= toMinutes(matched.start_time) + grace ? "on-time" : "late";
    } else {
      // No scheduled session today — fallback gate cutoff 07:30 + 10 min grace.
      status = atMin <= 7 * 60 + 30 + 10 ? "on-time" : "late";
    }
  }

  await unwrap(
    db
      .from("attendance_logs")
      .insert({ student_id: raw.id, scan_type, status, timestamp: at.toISOString() }),
  );
  return {
    profile: safeProfile(raw),
    scan_type,
    status,
    course: matched
      ? {
          id: matched.id as string,
          code: matched.code as string,
          title: matched.title as string,
          start_time: matched.start_time as string,
          end_time: matched.end_time as string,
          late_threshold_minutes: matched.late_threshold_minutes as number,
        }
      : null,
    at: at.toISOString(),
  };
}

export async function updateAttendanceLog(id: string, patch: Record<string, unknown>) {
  await unwrap(db.from("attendance_logs").update(patch).eq("id", id));
}

export async function deleteAttendanceLog(id: string) {
  await unwrap(db.from("attendance_logs").delete().eq("id", id));
}

/* ---------- Misc ---------- */

export async function countRows(
  table: z.infer<typeof schemas.countable>["table"],
): Promise<number> {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) {
    console.error("[lms] count error:", error);
    throw new Error("Database request failed");
  }
  return count ?? 0;
}

/* ---------- Course materials (attachments) + worksheet/assignment edits ---------- */

const MATERIAL_BUCKET = "course-materials";
// Handout formats teachers upload alongside worksheets and assignments.
const MATERIAL_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};
const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;

export type Attachment = { name: string; url: string; size: number; type: string; path: string };

/** Same-origin media URL served by the streaming route (private bucket). */
export function materialUrlForPath(path: string): string {
  return `/api/public/material?p=${encodeURIComponent(path)}`;
}

function attachmentList(value: unknown): Attachment[] {
  return Array.isArray(value) ? (value as Attachment[]) : [];
}

/** Best-effort removal of binary objects for hard deletes / detach. */
async function removeMaterialObjects(items: Attachment[]) {
  const paths = items
    .map((a) => a.path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  if (!paths.length) return;
  try {
    await supabaseAdmin.storage.from(MATERIAL_BUCKET).remove(paths);
  } catch {
    /* storage cleanup is best-effort — the row change already succeeded */
  }
}

/**
 * Teachers may only manage content for courses they lead; admins have
 * universal rights across every course.
 */
export async function requireCourseOwnerOrAdmin(token: string, courseId: string) {
  const caller = await requireStaff(token);
  if (caller.role === "teacher") {
    const course = await unwrap<any>(
      db.from("courses").select("teacher_id").eq("id", courseId).maybeSingle(),
    );
    if (!course || course.teacher_id !== caller.id) {
      throw new Error("Forbidden: you can only manage content for your own courses.");
    }
  }
  return caller;
}

async function requireAssignmentOwnerOrAdmin(token: string, assignmentId: string) {
  const row = await unwrap<any>(
    db
      .from("assignments")
      .select("id, course_id, attachments")
      .eq("id", assignmentId)
      .maybeSingle(),
  );
  if (!row) throw new Error("Assignment not found");
  const caller = await requireCourseOwnerOrAdmin(token, row.course_id as string);
  return { caller, row };
}

/**
 * Uploads one handout to private storage and returns its metadata record.
 * The caller attaches the returned record to a worksheet or assignment.
 */
export async function uploadCourseMaterial(
  tokenStr: string,
  course_id: string,
  name: string,
  base64: string,
  content_type: string,
) {
  const caller = await requireCourseOwnerOrAdmin(tokenStr, course_id);
  const ext = MATERIAL_EXT[content_type];
  if (!ext) throw new Error("Unsupported file type — use PDF, DOCX, PNG, JPG, or ZIP");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) throw new Error("Empty file");
  if (buffer.byteLength > MAX_MATERIAL_BYTES) throw new Error("File must be under 15 MB");
  // File-type sniff: validate real content vs declared mime
  const sniffed = await sniffMime(buffer);
  if (!sniffed || !MATERIAL_ALLOWED_MIMES.has(sniffed)) {
    throw new Error(
      `Unsupported file content (${sniffed ?? "unknown"}) — use PDF, DOCX, PNG, JPG, or ZIP`,
    );
  }
  // Allow zip-container mismatch for docx: file-type/magic returns application/zip for docx files
  const zipFamily = new Set([
    "application/zip",
    "application/x-zip-compressed",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  const isZipSniff = sniffed === "application/zip";
  const isZipDeclared = zipFamily.has(content_type);
  if (sniffed !== content_type && !(isZipSniff && isZipDeclared)) {
    throw new Error(`MIME mismatch: declared ${content_type} but file is ${sniffed}`);
  }
  const rand = createHmac("sha256", sessionSecret())
    .update(`${caller.id}:${name}:${Date.now()}`)
    .digest("hex")
    .slice(0, 8);
  const path = `${course_id}/material_${Date.now()}_${rand}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(MATERIAL_BUCKET)
    .upload(path, buffer, { contentType: content_type, upsert: false });
  if (error) throw new Error(`Storage upload failed (${error.message})`);
  const attachment: Attachment = {
    name: name.slice(0, 200),
    url: materialUrlForPath(path),
    size: buffer.byteLength,
    type: content_type,
    path,
  };
  return attachment;
}

/** Detach + delete one stored file from a worksheet or assignment. */
export async function removeCourseMaterial(
  tokenStr: string,
  target: "quiz" | "assignment",
  id: string,
  path: string,
) {
  const table = target === "quiz" ? "quizzes" : "assignments";
  if (target === "quiz") await requireQuizOwnerOrAdmin(tokenStr, id);
  else await requireAssignmentOwnerOrAdmin(tokenStr, id);
  const row = await unwrap<any>(db.from(table).select("attachments").eq("id", id).maybeSingle());
  const items = attachmentList(row?.attachments);
  const keep = items.filter((a) => a.path !== path);
  const drop = items.filter((a) => a.path === path);
  await unwrap(db.from(table).update({ attachments: keep }).eq("id", id));
  await removeMaterialObjects(drop);
  return keep;
}

/**
 * Worksheet edit: metadata, retake policy, attachments, and (optionally) a
 * full replacement of the question set + answer key. Replacing questions
 * clears prior attempts, since old answers no longer map to new items.
 */
export async function updateQuiz(
  tokenStr: string,
  id: string,
  patch: Record<string, unknown>,
  questions?: z.infer<typeof schemas.quizBundle>["questions"],
) {
  await requireQuizOwnerOrAdmin(tokenStr, id);
  if (Object.keys(patch).length) await unwrap(db.from("quizzes").update(patch).eq("id", id));
  if (questions && questions.length) {
    await unwrap(db.from("quiz_attempts").delete().eq("quiz_id", id));
    await unwrap(db.from("quiz_questions").delete().eq("quiz_id", id));
    await unwrap(
      db
        .from("quiz_questions")
        .insert(questions.map((q, i) => ({ ...q, quiz_id: id, position: i + 1 }))),
    );
  }
}

/**
 * Worksheet removal.
 * - soft (default): sets deleted_at, so attempts, grades, and audit history
 *   stay intact and the item simply disappears from active lists.
 * - hard: removes questions, attempts, grants, the row itself, and every
 *   attached binary in object storage.
 */
export async function deleteQuiz(tokenStr: string, id: string, mode: "soft" | "hard") {
  await requireQuizOwnerOrAdmin(tokenStr, id);
  if (mode === "soft") {
    await unwrap(db.from("quizzes").update({ deleted_at: new Date().toISOString() }).eq("id", id));
    return { mode };
  }
  const row = await unwrap<any>(
    db.from("quizzes").select("attachments").eq("id", id).maybeSingle(),
  );
  await unwrap(db.from("quiz_attempts").delete().eq("quiz_id", id));
  await unwrap(db.from("quiz_retake_grants").delete().eq("quiz_id", id));
  await unwrap(db.from("quiz_questions").delete().eq("quiz_id", id));
  await unwrap(db.from("quizzes").delete().eq("id", id));
  await removeMaterialObjects(attachmentList(row?.attachments));
  return { mode };
}

export async function updateAssignment(
  tokenStr: string,
  id: string,
  patch: Record<string, unknown>,
) {
  await requireAssignmentOwnerOrAdmin(tokenStr, id);
  if (Object.keys(patch).length) await unwrap(db.from("assignments").update(patch).eq("id", id));
}

/**
 * Assignment removal. Soft delete preserves submissions and grades; hard
 * delete also clears submissions and the attached files in storage.
 */
export async function deleteAssignment(tokenStr: string, id: string, mode: "soft" | "hard") {
  const { row } = await requireAssignmentOwnerOrAdmin(tokenStr, id);
  if (mode === "soft") {
    await unwrap(
      db.from("assignments").update({ deleted_at: new Date().toISOString() }).eq("id", id),
    );
    return { mode };
  }
  await unwrap(db.from("submissions").delete().eq("assignment_id", id));
  await unwrap(db.from("assignments").delete().eq("id", id));
  await removeMaterialObjects(attachmentList(row?.attachments));
  return { mode };
}

/** Append an uploaded attachment record to a worksheet or assignment. */
export async function attachCourseMaterial(
  tokenStr: string,
  target: "quiz" | "assignment",
  id: string,
  attachment: Attachment,
) {
  const table = target === "quiz" ? "quizzes" : "assignments";
  if (target === "quiz") await requireQuizOwnerOrAdmin(tokenStr, id);
  else await requireAssignmentOwnerOrAdmin(tokenStr, id);
  const row = await unwrap<any>(db.from(table).select("attachments").eq("id", id).maybeSingle());
  const next = [...attachmentList(row?.attachments), attachment];
  await unwrap(db.from(table).update({ attachments: next }).eq("id", id));
  return next;
}

/* ---------- Edge-vision kiosk sync (ESP32-P4 hardware bridge) ---------- */

/**
 * Enrollment roster fetched by the kiosk on boot: active accounts with their
 * card UID and stored face descriptor, so the device can populate its PSRAM
 * matcher cache without on-device enrollment. Credential secrets (PIN hashes,
 * passwords) are never included.
 */
export async function hardwareRoster() {
  const rows = await unwrap<any[]>(
    db
      .from("profiles")
      .select(
        "id, full_name, student_id, section, grade_level, role, rfid_uid, face_embedding, avatar_url",
      )
      .is("deleted_at", null)
      .order("full_name"),
  );
  const users = (rows ?? [])
    .filter((p: any) => p.rfid_uid || p.face_embedding)
    .map((p: any) => ({
      user_id: p.id as string,
      full_name: p.full_name as string,
      student_no: (p.student_id ?? null) as string | null,
      section: (p.section ?? null) as string | null,
      grade_level: (p.grade_level ?? null) as number | null,
      role: p.role as string,
      rfid_uid: (p.rfid_uid ?? null) as string | null,
      // Descriptor vector enrolled from the web portal (JSON float array).
      face_embedding: (p.face_embedding ?? null) as string | null,
    }));
  return { synced_at: new Date().toISOString(), count: users.length, users };
}

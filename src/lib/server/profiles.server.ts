/* eslint-disable @typescript-eslint/no-explicit-any */
// Profiles & kiosk auth — CRUD, PIN login, RFID, biometrics.
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, supabaseAdmin } from "@/integrations/db/client.server";
import { getBucket } from "@/lib/rate-limit";
import { unwrap, withoutToken } from "@/lib/server/utils.server";
import { createSessionToken, revokeSessions, sessionSecret } from "@/lib/server/sessions.server";

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

export type SafeProfile = ReturnType<typeof safeProfile>;

/* ---------- RFID lookup ---------- */

export async function findByRfid(uid: string) {
  const p = await unwrap<any>(
    db.from("profiles").select("*").eq("rfid_uid", uid).is("deleted_at", null).maybeSingle(),
  );
  return p ? { profile: safeProfile(p), token: createSessionToken(p.id as string) } : null;
}

/* ---------- PIN verification ---------- */

async function verifyPin(p: any, pin: string): Promise<boolean> {
  const key = `pin:${p.id ?? p.student_id ?? p.email ?? "unknown"}`;
  const bucket = getBucket(key);
  if (bucket.remaining === 0) {
    const err: any = new Error("Too many attempts");
    err.status = 429;
    throw err;
  }
  let ok = false;
  if (typeof p.pin_hash === "string" && p.pin_hash) {
    try {
      ok = await bcrypt.compare(pin, p.pin_hash);
    } catch {
      ok = false;
    }
  }
  // Legacy plaintext row not yet backfilled — compare, then opportunistically
  // upgrade to a bcrypt hash and clear the plaintext copy.
  if (!ok && typeof p.pin === "string" && p.pin.length > 0 && p.pin === pin) {
    await db
      .from("profiles")
      .update({ pin_hash: await bcrypt.hash(pin, 10), pin: null })
      .eq("id", p.id);
    ok = true;
  }
  if (!ok) bucket.consume();
  return ok;
}

/* ---------- Unified PIN/password sign-in (all roles) ---------- */

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

async function verifySecret(p: any, secret: string): Promise<boolean> {
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
  const dbgS = (msg: string, data?: unknown) => {
    if (process.env["DEBUG_LOGS"] === "true") console.debug(`[auth:server] ${msg}`, data ?? "");
  };
  dbgS("verifyPinLogin called", { login: login.trim() });
  const identifier = login.trim().replace(/[*%]/g, "");
  if (!identifier || !secret) return { ok: false as const, reason: "invalid" as const };

  const identBucket = getBucket(`login:ident:${identifier.toLowerCase()}`);
  if (!identBucket.consume()) {
    const err: any = new Error("Too many attempts");
    err.status = 429;
    throw err;
  }

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
  if (!p) { dbgS("profile not found", { identifier }); return { ok: false as const, reason: "invalid" as const }; }
  dbgS("profile found", { email: p.email, role: p.role, hasPinHash: !!p.pin_hash, locked: !!p.locked_until });

  const now = Date.now();
  const lockedUntil = typeof p.locked_until === "string" ? Date.parse(p.locked_until) : 0;
  if (lockedUntil > now) {
    return {
      ok: false as const,
      reason: "locked" as const,
      retryAfterMinutes: Math.max(1, Math.ceil((lockedUntil - now) / 60000)),
    };
  }

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

  if (p.failed_login_attempts || p.locked_until) {
    await db
      .from("profiles")
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq("id", p.id);
  }
  dbgS("login success", { email: p.email, role: p.role });
  return { ok: true as const, profile: safeProfile(p), token: createSessionToken(p.id) };
}

/* ---------- Profile CRUD ---------- */

export async function getProfileById(id: string) {
  const p = await unwrap<any>(
    db.from("profiles").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
  );
  return p ? safeProfile(p) : null;
}

export async function createProfile(input: z.infer<ReturnType<typeof getProfileInputSchema>>) {
  const row: Record<string, unknown> = withoutToken(input);
  if (typeof row["email"] === "string")
    row["email"] = (row["email"] as string).trim().toLowerCase();
  await assertUniqueIdentity({
    email: (row["email"] as string | null) ?? null,
    student_id: (row["student_id"] as string | null) ?? null,
    rfid_uid: (row["rfid_uid"] as string | null) ?? null,
  });
  if (typeof row["pin"] === "string" && row["pin"]) {
    row["pin_hash"] = await bcrypt.hash(row["pin"], 10);
    row["pin"] = null;
  }
  const p = await unwrap<any>(db.from("profiles").insert(row).select().single());
  return safeProfile(p);
}

// Schema getter so the schemas module can reference it without circular deps.
function getProfileInputSchema() {
  return z.object({
    full_name: z.string().min(1).max(200),
    student_id: z.string().max(50).nullable().optional(),
    email: z.string().max(320).nullable().optional(),
    role: z.enum(["student", "teacher", "admin"]).optional(),
    grade_level: z.number().int().min(7).max(16).nullable().optional(),
    section: z.string().max(50).nullable().optional(),
    employee_id: z.string().max(50).nullable().optional(),
    prefix: z.string().max(20).nullable().optional(),
    department: z.string().max(100).nullable().optional(),
    pin: z.string().regex(/^\d{4,8}$/).nullable().optional(),
    rfid_uid: z.string().regex(/^\d{6,20}$/).nullable().optional(),
    avatar_url: z.string().max(2048).regex(/^(https:\/\/|\/api\/public\/avatar\?p=)/).nullable().optional(),
    token: z.string().min(1).max(4096),
  });
}

const SELF_PATCH_KEYS = ["full_name", "email", "avatar_url", "pin", "rfid_uid"];

export function selfServicePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SELF_PATCH_KEYS) {
    if (key in patch) out[key] = patch[key];
  }
  if (Object.keys(out).length === 0) throw new Error("Forbidden");
  return out;
}

const CREDENTIAL_KEYS = ["pin", "rfid_uid", "email", "username", "password", "face_embedding"];

export async function authorizeProfileUpdate(
  token: string,
  targetId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Import dynamically to avoid circular deps
  const { requireSession } = await import("@/lib/server/auth.server");
  const caller = await requireSession(token);
  if (caller.id === targetId) {
    return caller.role === "student" ? selfServicePatch(patch) : patch;
  }
  if (caller.role === "student") throw new Error("Forbidden");

  const target = await getProfileById(targetId);
  if (!target) throw new Error("Profile not found");

  if (target.role !== "student" && caller.role !== "admin") {
    throw new Error("Forbidden: only an administrator may edit staff accounts.");
  }
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
    row["pin"] = null;
  }
  await unwrap(db.from("profiles").update(row).eq("id", id));
  if ("role" in row || "pin_hash" in row || "password_hash" in row) {
    await revokeSessions(id);
  }
}

export async function updateTeacherSettings(teacherId: string, patch: Record<string, unknown>) {
  if (Object.keys(patch).length === 0) throw new Error("Nothing to update");
  await updateProfile(teacherId, patch);
  const fresh = await getProfileById(teacherId);
  if (!fresh) throw new Error("Unauthorized");
  return fresh;
}

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
  const cleared = await unwrap<any[]>(
    db.from("courses").update({ teacher_id: null }).eq("teacher_id", id).select("id"),
  );
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

export async function listTeachers() {
  const rows = await unwrap<any[]>(
    db.from("profiles").select("*").eq("role", "teacher").is("deleted_at", null).order("full_name"),
  );
  return rows.map(safeProfile);
}

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

export async function assertUniqueIdentity(
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

export async function createTeacher(input: {
  full_name: string;
  prefix?: string | null;
  email: string;
  employee_id: string;
  department: string;
  pin: string;
  rfid_uid?: string | null;
  token: string;
}) {
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
  row["username"] = input.employee_id.trim();
  if (!row["rfid_uid"]) row["rfid_uid"] = null;
  const created = await unwrap<any>(db.from("profiles").insert(row).select().single());

  return { ...safeProfile(created), courses: [] as { id: string; title: string; code: string }[] };
}

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

export async function listAllUsers() {
  const rows = await unwrap<any[]>(
    db.from("profiles").select("*").is("deleted_at", null).order("full_name"),
  );
  return rows.map(safeProfile);
}

export async function updateUserRole(
  adminId: string,
  id: string,
  role: "student" | "teacher" | "admin",
) {
  if (adminId === id) throw new Error("You can't change your own role");
  const target = await getProfileById(id);
  if (!target) throw new Error("User not found");
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

/* ---------- File-type sniff (file-type pkg or magic-byte fallback) ---------- */

const AVATAR_ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

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

/* ---------- Avatar upload pipeline ---------- */

const AVATAR_BUCKET = "avatars";
const AVATAR_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function avatarUrlForPath(path: string): string {
  return `/api/public/avatar?p=${encodeURIComponent(path)}`;
}

export async function uploadAvatar(tokenStr: string, base64: string, contentType: string) {
  const { requireSession } = await import("@/lib/server/auth.server");
  const caller = await requireSession(tokenStr);
  const ext = AVATAR_EXT[contentType];
  if (!ext) throw new Error("Unsupported image type — use PNG, JPEG, WebP, or GIF");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) throw new Error("Empty image");
  if (buffer.byteLength > 2 * 1024 * 1024) throw new Error("Image must be under 2 MB");
  const sniffed = await sniffMime(buffer);
  if (!sniffed || !AVATAR_ALLOWED_MIMES.has(sniffed))
    throw new Error(
      `Unsupported image content (${sniffed ?? "unknown"}) — use PNG, JPEG, WebP, or GIF`,
    );
  if (sniffed !== contentType)
    throw new Error(`MIME mismatch: declared ${contentType} but file is ${sniffed}`);
  const { createHmac, randomUUID } = await import("node:crypto");
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

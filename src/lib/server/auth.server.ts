/* eslint-disable @typescript-eslint/no-explicit-any */
// Auth guards — session resolution with role checks.
import { db } from "@/integrations/db/client.server";
import { unwrap } from "@/lib/server/utils.server";
import { verifySessionToken } from "@/lib/server/sessions.server";
import { getProfileById } from "@/lib/server/profiles.server";

/** Verify the caller's token and load their real profile. Throws if invalid. */
export async function requireSession(token: string) {
  const id = verifySessionToken(token);
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
    // DB unavailable — log but allow through to avoid total lockout
    console.error("[auth] JTI revocation check failed (DB may be down):", e?.message ?? e);
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

/** Caller must be an admin. */
export async function requireAdmin(token: string) {
  const profile = await requireSession(token);
  if (profile.role !== "admin") throw new Error("Forbidden");
  return profile;
}

/** Caller must be a teacher. */
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

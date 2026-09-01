/* eslint-disable @typescript-eslint/no-explicit-any */
// Attendance — logging, tap status engine, schedule-aware status.
import { db } from "@/integrations/db/client.server";
import { unwrap } from "@/lib/server/utils.server";
import { listCourses, enrollmentsForStudent } from "@/lib/server/courses.server";
import { safeProfile } from "@/lib/server/profiles.server";

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

export async function recordTap(uid: string, atISO?: string) {
  const raw = await unwrap<any>(
    db.from("profiles").select("*").eq("rfid_uid", uid).is("deleted_at", null).maybeSingle(),
  );
  if (!raw) return null;
  return recordTapForProfile(raw, atISO);
}

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

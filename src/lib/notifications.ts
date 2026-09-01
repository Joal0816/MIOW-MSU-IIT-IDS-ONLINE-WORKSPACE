import { NOTIFICATION_SIGNOFF } from "./brand";
import type { Announcement } from "./lms";

/**
 * Stub notification pipeline — logs MIOW signoff and returns queued=false
 * until a real email/push provider is wired. Call this after creating an
 * announcement so `NOTIFICATION_SIGNOFF` is exercised centrally.
 */
export async function notifyAnnouncement(
  a: Pick<Announcement, "title" | "content" | "target_audience">,
): Promise<{ queued: false; reason: string }> {
  console.log(
    `[notify] ${a.title ?? "Untitled"} → ${a.target_audience ?? "all"}\n${NOTIFICATION_SIGNOFF}`,
  );
  if (a.content) console.log(`[notify] body: ${String(a.content).slice(0, 160)}`);
  return { queued: false as const, reason: "no pipeline" };
}

export async function notifyAnnouncementById(
  _id: string,
): Promise<{ queued: false; reason: string }> {
  console.log(`[notify] by id ${_id}\n${NOTIFICATION_SIGNOFF}`);
  return { queued: false as const, reason: "no pipeline" };
}

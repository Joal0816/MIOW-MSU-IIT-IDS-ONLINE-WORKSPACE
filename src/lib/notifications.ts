import type { Announcement } from "./lms";

/** Stub notification pipeline — returns queued=false until a real provider is wired. */
export async function notifyAnnouncement(
  _a: Pick<Announcement, "title" | "content" | "target_audience">,
): Promise<{ queued: false; reason: string }> {
  return { queued: false as const, reason: "no pipeline" };
}

export async function notifyAnnouncementById(
  _id: string,
): Promise<{ queued: false; reason: string }> {
  return { queued: false as const, reason: "no pipeline" };
}

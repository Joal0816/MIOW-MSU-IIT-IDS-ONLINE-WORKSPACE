/* eslint-disable @typescript-eslint/no-explicit-any */
// Announcements — CRUD.
import { z } from "zod";
import { db } from "@/integrations/db/client.server";
import { unwrap, withoutToken } from "@/lib/server/utils.server";

export async function listAnnouncements() {
  return unwrap<any[]>(
    db
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
  );
}

export async function createAnnouncement(input: z.infer<ReturnType<typeof getAnnouncementInputSchema>>) {
  await unwrap(db.from("announcements").insert(withoutToken(input)));
}

export async function updateAnnouncement(id: string, patch: Record<string, unknown>) {
  await unwrap(db.from("announcements").update(patch).eq("id", id));
}

export async function deleteAnnouncement(id: string) {
  await unwrap(db.from("announcements").delete().eq("id", id));
}

function getAnnouncementInputSchema() {
  return z.object({
    title: z.string().min(1).max(300),
    content: z.string().min(1).max(5000),
    category: z.enum(["urgent", "event", "academic"]),
    target_audience: z.string().max(50).optional(),
    author_id: z.string().uuid().nullable().optional(),
    token: z.string().min(1).max(4096),
  });
}

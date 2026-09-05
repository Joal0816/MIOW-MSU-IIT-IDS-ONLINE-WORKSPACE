/* eslint-disable @typescript-eslint/no-explicit-any */
// Announcements — CRUD + file attachments.
import { createHmac } from "node:crypto";
import { extname } from "node:path";
import { z } from "zod";
import { db } from "@/integrations/db/client.server";
import { unwrap, withoutToken } from "@/lib/server/utils.server";
import { requireStaff } from "@/lib/server/auth.server";
import { sessionSecret } from "@/lib/server/sessions.server";

export type AnnouncementAttachment = {
  id: string;
  announcement_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime: string;
  created_at: string;
};

const ANNOUNCEMENT_BUCKET = "course-materials";
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
]);
const EXT_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};
const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".zip": "application/zip",
};
const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;

export async function listAnnouncements() {
  return unwrap<any[]>(
    db
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
  );
}

export async function createAnnouncement(
  input: z.infer<ReturnType<typeof getAnnouncementInputSchema>>,
): Promise<string> {
  const row = await unwrap<any>(
    db.from("announcements").insert(withoutToken(input)).select("id").single(),
  );
  return row.id as string;
}

export async function updateAnnouncement(id: string, patch: Record<string, unknown>) {
  await unwrap(db.from("announcements").update(patch).eq("id", id));
}

export async function deleteAnnouncement(id: string) {
  // Clean up attachments before deleting
  const attachments = await listAnnouncementAttachments(id);
  if (attachments.length) {
    await removeAnnouncementAttachmentObjects(attachments);
    await unwrap(db.from("announcement_attachments").delete().eq("announcement_id", id));
  }
  await unwrap(db.from("announcements").delete().eq("id", id));
}

export async function listAnnouncementAttachments(
  announcementId: string,
): Promise<AnnouncementAttachment[]> {
  return unwrap<AnnouncementAttachment[]>(
    db
      .from("announcement_attachments")
      .select("*")
      .eq("announcement_id", announcementId)
      .order("created_at"),
  );
}

export async function uploadAnnouncementMaterial(
  tokenStr: string,
  announcementId: string,
  name: string,
  base64: string,
  content_type: string,
): Promise<AnnouncementAttachment> {
  await requireStaff(tokenStr);
  if (!content_type || !EXT_MAP[content_type]) {
    const fileExt = extname(name).toLowerCase();
    const inferred = EXT_TO_MIME[fileExt];
    if (inferred) content_type = inferred;
  }
  const ext = EXT_MAP[content_type];
  if (!ext) throw new Error("Unsupported file type — use PDF, DOCX, PNG, JPG, or ZIP");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) throw new Error("Empty file");
  if (buffer.byteLength > MAX_MATERIAL_BYTES) throw new Error("File must be under 25 MB");
  if (!ALLOWED_MIMES.has(content_type)) {
    throw new Error(`Unsupported file type: ${content_type}`);
  }
  const rand = createHmac("sha256", sessionSecret())
    .update(`${announcementId}:${name}:${Date.now()}`)
    .digest("hex")
    .slice(0, 8);
  const path = `${announcementId}/material_${Date.now()}_${rand}.${ext}`;
  const { error } = await db.storage
    .from(ANNOUNCEMENT_BUCKET)
    .upload(path, buffer, { contentType: content_type, upsert: false });
  if (error) throw new Error(`Storage upload failed (${error.message})`);
  const file_url = `/api/public/material?p=${encodeURIComponent(path)}`;
  const row: Omit<AnnouncementAttachment, "id" | "created_at"> = {
    announcement_id: announcementId,
    file_url,
    file_name: name.slice(0, 200),
    file_size: buffer.byteLength,
    mime: content_type,
  };
  const inserted = await unwrap<any>(
    db.from("announcement_attachments").insert(row).select("*").single(),
  );
  return inserted as AnnouncementAttachment;
}

export async function removeAnnouncementAttachment(
  tokenStr: string,
  attachmentId: string,
): Promise<void> {
  await requireStaff(tokenStr);
  const row = await unwrap<any>(
    db.from("announcement_attachments").select("*").eq("id", attachmentId).maybeSingle(),
  );
  if (!row) throw new Error("Attachment not found");
  await removeAnnouncementAttachmentObjects([row as AnnouncementAttachment]);
  await unwrap(db.from("announcement_attachments").delete().eq("id", attachmentId));
}

async function removeAnnouncementAttachmentObjects(items: AnnouncementAttachment[]) {
  const paths = items
    .map((a) => a.file_url)
    .map((url) => {
      try {
        const u = new URL(url, "http://localhost");
        return u.searchParams.get("p") ?? "";
      } catch {
        const match = url.match(/[?&]p=([^&]+)/);
        return match?.[1] ? decodeURIComponent(match[1]) : "";
      }
    })
    .filter((p) => p.length > 0);
  if (!paths.length) return;
  try {
    await db.storage.from(ANNOUNCEMENT_BUCKET).remove(paths);
  } catch {
    /* storage cleanup is best-effort */
  }
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

// Streams course handouts from the private "course-materials" bucket.
// The prefix is only "public" in the routing sense — every request must carry
// a valid signed kiosk session token (?t=), and only paths matching the strict
// material shape are served, never arbitrary bucket contents.
import { createFileRoute } from "@tanstack/react-router";

const PATH_RE = /^[0-9a-f-]{36}\/material_\d+_[0-9a-f]{8}\.(pdf|docx?|png|jpe?g|zip)$/;
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  zip: "application/zip",
};

export const Route = createFileRoute("/api/public/material")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const p = url.searchParams.get("p") ?? "";
        const t = url.searchParams.get("t") ?? "";
        if (!PATH_RE.test(p)) return new Response("Not found", { status: 404 });
        const server = await import("@/lib/lms.server");
        try {
          await server.requireSession(t);
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("course-materials").download(p);
        if (error || !data) return new Response("Not found", { status: 404 });
        const ext = p.split(".").pop()!;
        return new Response(data, {
          headers: {
            "Content-Type": MIME[ext] ?? "application/octet-stream",
            "Content-Disposition": "inline",
            // Signed-in content: never cached by shared caches.
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});

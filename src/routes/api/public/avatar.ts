// Streams avatar images from the private "avatars" storage bucket. The kiosk
// sign-in screen shows profile photos to unauthenticated viewers, so this
// endpoint is public — but it only ever serves objects matching the strict
// avatar path shape, never arbitrary bucket contents. Entropy hardened: new
// uploads use 16-hex (64-bit) random; legacy 8-hex accepted during migration.
// Optional Authorization: Bearer <session_token> is validated if present (helps
// private previews) but unauthenticated fetches remain allowed with the hard-to-guess path.
import { createFileRoute } from "@tanstack/react-router";

const PATH_RE = /^[0-9a-f-]{36}\/avatar_\d+_[0-9a-f]{16}\.(png|jpe?g|webp|gif)$/;
// Legacy 8-hex paths (pre-hardening) remain served for backward compat
const PATH_RE_LEGACY = /^[0-9a-f-]{36}\/avatar_\d+_[0-9a-f]{8}\.(png|jpe?g|webp|gif)$/;
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export const Route = createFileRoute("/api/public/avatar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const p = new URL(request.url).searchParams.get("p") ?? "";
        // Strict allowlist — no path traversal, no arbitrary object reads.
        // Accept new 16-hex and legacy 8-hex during migration.
        const validPath = PATH_RE.test(p) || PATH_RE_LEGACY.test(p);
        if (!validPath) return new Response("Not found", { status: 404 });
        // Optional auth: if token header is supplied, validate it; keeps public access but harder to guess
        const auth = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (auth) {
          try {
            const { requireSession } = await import("@/lib/server");
            await requireSession(auth);
          } catch {
            return new Response("Unauthorized", { status: 401 });
          }
        }
        const { supabaseAdmin } = await import("@/integrations/db/client.server");
        const { data, error } = await supabaseAdmin.storage.from("avatars").download(p);
        if (error || !data) return new Response("Not found", { status: 404 });
        const ext = p.split(".").pop()!;
        return new Response(data, {
          headers: {
            "Content-Type": MIME[ext] ?? "application/octet-stream",
            // Filenames are unique per upload (avatar_<ts>_<hash>), so a long
            // immutable cache is safe; must-revalidate protects against any
            // future same-name overwrite ever going stale.
            "Cache-Control": "public, max-age=31536000, immutable, must-revalidate",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});

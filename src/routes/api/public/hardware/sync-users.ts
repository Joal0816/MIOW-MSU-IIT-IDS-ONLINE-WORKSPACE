// Boot-time enrollment sync for the ESP32-P4 edge-vision kiosk.
// GET /api/public/hardware/sync-users
//   Authorization: Bearer <HARDW...KEY>
//   X-Hardware-Timestamp: <ISO-8601>  (required, 5-min window)
// Returns active accounts with their RFID UID and enrolled face descriptor so
// the device can fill its PSRAM matcher cache. No credential secrets are ever
// returned, and an unauthenticated caller gets 401.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

// In-memory rate limit: 60 req / 60s per IP (per-instance, best-effort).
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const _rate = new Map<string, number[]>();
function hitRateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (_rate.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  _rate.set(ip, hits);
  if (_rate.size > 1000) {
    for (const [k, v] of _rate) {
      const last = v[v.length - 1];
      if (!v.length || (last != null && now - last > RATE_LIMIT_WINDOW_MS)) _rate.delete(k);
    }
  }
  return hits.length > RATE_LIMIT_MAX;
}

function authorized(request: Request): boolean {
  const expected = process.env["HARDWARE_API_KEY"];
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  // Replay protection: require X-Hardware-Timestamp within 5-minute window.
  const tsRaw = request.headers.get("x-hardware-timestamp");
  if (!tsRaw) return false;
  const ts = Date.parse(tsRaw);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hardware/sync-users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";
        if (hitRateLimit(ip))
          return new Response("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": "60" },
          });
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const server = await import("@/lib/lms.server");
        const payload = await server.hardwareRoster();
        return Response.json(payload, {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});

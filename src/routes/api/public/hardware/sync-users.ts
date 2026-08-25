// Boot-time enrollment sync for the ESP32-P4 edge-vision kiosk.
// GET /api/public/hardware/sync-users
//   Authorization: Bearer <HARDWARE_API_KEY>
// Returns active accounts with their RFID UID and enrolled face descriptor so
// the device can fill its PSRAM matcher cache. No credential secrets are ever
// returned, and an unauthenticated caller gets 401.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

function authorized(request: Request): boolean {
  const expected = process.env["HARDWARE_API_KEY"];
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hardware/sync-users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

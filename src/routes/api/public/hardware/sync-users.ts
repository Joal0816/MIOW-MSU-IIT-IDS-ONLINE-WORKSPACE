// Boot-time enrollment sync for the ESP32-P4 edge-vision kiosk.
// GET /api/public/hardware/sync-users
import { createFileRoute } from "@tanstack/react-router";
import { guardHardwareRequest } from "@/lib/server/hardware-auth.server";

export const Route = createFileRoute("/api/public/hardware/sync-users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const guard = guardHardwareRequest(request);
        if (!guard.ok) return guard.response;
        const server = await import("@/lib/lms.server");
        const payload = await server.hardwareRoster();
        return Response.json(payload, {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});

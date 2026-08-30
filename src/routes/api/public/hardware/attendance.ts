// Live check-in dispatch from the ESP32-P4 kiosk.
// POST /api/public/hardware/attendance
//   Authorization: Bearer <HARDWARE_API_KEY>
//   { "user_id": "<uuid>" | "rfid_uid": "0123456789",
//     "timestamp": "2026-08-25T08:02:00Z", "confidence": 0.91 }
//
// The web side owns the status engine: the tap timestamp is compared with the
// matched course schedule (start time + grace) to mark ON TIME or LATE, and
// the resulting log appears on the live attendance screen.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const Body = z
  .object({
    user_id: z.string().uuid().optional(),
    rfid_uid: z.string().min(1).max(64).optional(),
    timestamp: z.string().max(40).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .refine((b) => !!b.user_id || !!b.rfid_uid, {
    message: "user_id or rfid_uid is required",
  });

// A face match below this cosine-similarity confidence is rejected rather
// than logged, mirroring the device-side 0.55 distance threshold.
const MIN_CONFIDENCE = 0.45;

function authorized(request: Request): boolean {
  const expected = process.env["HARDWARE_API_KEY"];
  if (!expected) return false;
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hardware/attendance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });
        }
        if (body.confidence != null && body.confidence < MIN_CONFIDENCE) {
          return Response.json({ ok: false, error: "Low confidence match" }, { status: 422 });
        }
        const server = await import("@/lib/lms.server");
        const result = body.user_id
          ? await server.recordTapByProfileId(body.user_id, body.timestamp)
          : await server.recordTap(body.rfid_uid!, body.timestamp);
        if (!result) return Response.json({ ok: false, error: "Unknown user" }, { status: 404 });
        return Response.json(
          {
            ok: true,
            student: { id: result.profile.id, full_name: result.profile.full_name },
            scan_type: result.scan_type,
            status: result.status,
            course: result.course,
            at: result.at,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import * as server from "@/lib/lms.server";

/**
 * PATCH /api/teacher/settings
 *
 * HTTP surface for faculty self-service settings (profile fields, avatar URL,
 * kiosk credentials). Authentication is mandatory: the caller must present a
 * signed LMS session token (Authorization: Bearer <token>, or `token` in the
 * JSON body) that resolves to a profile with role === "teacher". The target
 * row is always the caller's own profile — the body cannot name another user.
 */
export const Route = createFileRoute("/api/teacher/settings")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const token = bearer || (typeof body["token"] === "string" ? (body["token"] as string) : "");
        try {
          const parsed = server.schemas.teacherSettings.parse({
            token,
            patch: body["patch"] ?? {},
          });
          const teacher = await server.requireTeacher(parsed.token);
          const profile = await server.updateTeacherSettings(teacher.id, parsed.patch);
          return Response.json({ profile });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Request failed";
          const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

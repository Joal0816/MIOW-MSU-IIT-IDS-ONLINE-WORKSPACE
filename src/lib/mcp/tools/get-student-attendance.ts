import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "get_student_attendance",
  title: "Get student attendance",
  description:
    "Return recent gate scan history for a specific student, by student profile id. Staff accounts only.",
  inputSchema: {
    student_id: z.string().uuid().describe("The student's profile id (see list_students)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Maximum log entries to return (default 60)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ student_id, limit }, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    if (caller.profile.role === "student") {
      return fail("Only teacher or admin accounts can view other students' attendance.");
    }
    const { data, error } = await caller.supabase
      .from("attendance_logs")
      .select("timestamp, scan_type, status")
      .eq("student_id", student_id)
      .order("timestamp", { ascending: false })
      .limit(limit ?? 60);
    if (error) return fail(`Could not load attendance: ${error.message}`);
    return ok(data ?? []);
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "get_my_attendance",
  title: "Get my attendance",
  description:
    "Return the signed-in student's recent gate scan history (tap in/out) with a summary of on-time vs late arrivals.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Maximum log entries to return (default 60)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    if (caller.profile.role !== "student") {
      return fail("Staff accounts should use get_student_attendance with a student id instead.");
    }
    const { data, error } = await caller.supabase
      .from("attendance_logs")
      .select("timestamp, scan_type, status")
      .eq("student_id", caller.profile.id)
      .order("timestamp", { ascending: false })
      .limit(limit ?? 60);
    if (error) return fail(`Could not load attendance: ${error.message}`);
    const logs = (data ?? []) as Array<{ scan_type: string; status: string }>;
    const tapsIn = logs.filter((l) => l.scan_type === "in");
    const summary = {
      total_scans: logs.length,
      days_tapped_in: tapsIn.length,
      late_arrivals: tapsIn.filter((l) => l.status === "late").length,
      on_time_arrivals: tapsIn.filter((l) => l.status === "on-time").length,
    };
    return ok({ summary, logs });
  },
});

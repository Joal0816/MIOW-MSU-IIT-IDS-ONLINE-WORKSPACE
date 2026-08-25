import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "get_student_grades",
  title: "Get student grades",
  description:
    "Return quarterly grades for a specific student, by student profile id. Staff accounts only.",
  inputSchema: {
    student_id: z.string().uuid().describe("The student's profile id (see list_students)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ student_id }, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    if (caller.profile.role === "student") {
      return fail("Only teacher or admin accounts can view other students' grades.");
    }
    const { data, error } = await caller.supabase
      .from("grades")
      .select(
        "quarter, written_work_score, performance_task_score, exam_score, transmuted_final_grade, courses(title, code)",
      )
      .eq("student_id", student_id)
      .order("quarter");
    if (error) return fail(`Could not load grades: ${error.message}`);
    return ok(data ?? []);
  },
});

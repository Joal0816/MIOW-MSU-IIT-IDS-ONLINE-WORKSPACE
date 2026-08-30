import { defineTool } from "@lovable.dev/mcp-js";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "get_my_grades",
  title: "Get my grades",
  description:
    "Return the signed-in student's quarterly grades per course: written work, performance task, and exam scores plus the transmuted final grade.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    if (caller.profile.role !== "student") {
      return fail("Staff accounts should use get_student_grades with a student id instead.");
    }
    const { data, error } = await caller.supabase
      .from("grades")
      .select(
        "quarter, written_work_score, performance_task_score, exam_score, transmuted_final_grade, courses(title, code)",
      )
      .eq("student_id", caller.profile.id)
      .order("quarter");
    if (error) return fail(`Could not load grades: ${error.message}`);
    return ok(data ?? []);
  },
});

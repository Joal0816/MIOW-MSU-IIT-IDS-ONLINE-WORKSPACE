import { defineTool } from "@lovable.dev/mcp-js";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "list_courses",
  title: "List courses",
  description:
    "List the school course catalog. For students, each course is flagged with whether they are enrolled; for teachers, whether they teach it.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    const { data: courses, error } = await caller.supabase
      .from("courses")
      .select("id, title, code, grade_level, teacher_id, color")
      .order("code");
    if (error) return fail(`Could not load courses: ${error.message}`);

    let enrolledIds = new Set<string>();
    if (caller.profile.role === "student") {
      const { data: enrollments } = await caller.supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", caller.profile.id);
      enrolledIds = new Set((enrollments ?? []).map((e: { course_id: string }) => e.course_id));
    }

    const result = (courses ?? []).map(
      (c: { id: string; teacher_id: string | null } & Record<string, unknown>) => ({
        ...c,
        enrolled: caller.profile.role === "student" ? enrolledIds.has(c.id) : undefined,
        teaching: caller.profile.role !== "student" ? c.teacher_id === caller.profile.id : undefined,
      }),
    );
    return ok(result);
  },
});

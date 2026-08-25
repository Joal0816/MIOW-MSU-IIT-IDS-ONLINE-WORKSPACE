import { defineTool } from "@lovable.dev/mcp-js";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "list_my_assignments",
  title: "List my assignments",
  description:
    "List assignments for the signed-in user's courses. Students see assignments for enrolled courses with their submission status; teachers see assignments for the courses they teach.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    const { supabase, profile } = caller;

    let courseIds: string[] = [];
    if (profile.role === "student") {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", profile.id);
      if (error) return fail(`Could not load enrollments: ${error.message}`);
      courseIds = (data ?? []).map((e: { course_id: string }) => e.course_id);
    } else {
      const { data, error } = await supabase
        .from("courses")
        .select("id")
        .eq("teacher_id", profile.id);
      if (error) return fail(`Could not load courses: ${error.message}`);
      courseIds = (data ?? []).map((c: { id: string }) => c.id);
    }
    if (courseIds.length === 0) return ok([]);

    const { data: assignments, error } = await supabase
      .from("assignments")
      .select("id, course_id, title, description, due_date, total_points, component_type, courses(title, code)")
      .in("course_id", courseIds)
      .order("due_date");
    if (error) return fail(`Could not load assignments: ${error.message}`);

    let statusByAssignment = new Map<string, string>();
    if (profile.role === "student" && (assignments ?? []).length > 0) {
      const { data: subs } = await supabase
        .from("submissions")
        .select("assignment_id, status, score")
        .eq("student_id", profile.id)
        .in(
          "assignment_id",
          (assignments ?? []).map((a: { id: string }) => a.id),
        );
      statusByAssignment = new Map(
        (subs ?? []).map((s: { assignment_id: string; status: string; score: number | null }) => [
          s.assignment_id,
          s.score != null ? `${s.status} (score ${s.score})` : s.status,
        ]),
      );
    }

    const result = (assignments ?? []).map((a: { id: string } & Record<string, unknown>) => ({
      ...a,
      my_submission: profile.role === "student" ? (statusByAssignment.get(a.id) ?? "not submitted") : undefined,
    }));
    return ok(result);
  },
});

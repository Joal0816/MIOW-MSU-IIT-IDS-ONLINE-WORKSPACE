import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "submit_assignment",
  title: "Submit assignment",
  description:
    "Submit or update the signed-in student's text response for an assignment in a course they are enrolled in.",
  inputSchema: {
    assignment_id: z.string().uuid().describe("The assignment id to submit work for."),
    content: z
      .string()
      .trim()
      .min(1)
      .max(20000)
      .describe("The student's written submission or answer text."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ assignment_id, content }, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    if (caller.profile.role !== "student") {
      return fail("Only student accounts can submit assignments.");
    }
    const { supabase, profile } = caller;

    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .select("id, course_id, title, due_date")
      .eq("id", assignment_id)
      .maybeSingle();
    if (aErr) return fail(`Could not load assignment: ${aErr.message}`);
    if (!assignment) return fail("Assignment not found.");

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", profile.id)
      .eq("course_id", assignment.course_id)
      .maybeSingle();
    if (!enrollment) return fail("You are not enrolled in this assignment's course.");

    const row = {
      assignment_id,
      student_id: profile.id,
      content,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase
      .from("submissions")
      .select("id")
      .eq("assignment_id", assignment_id)
      .eq("student_id", profile.id)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("submissions").update(row).eq("id", existing.id)
      : await supabase.from("submissions").insert(row);
    if (error) return fail(`Submission failed: ${error.message}`);
    return ok(
      { assignment_id, title: assignment.title, status: "submitted", submitted_at: row.submitted_at },
      `Submitted work for "${assignment.title}".`,
    );
  },
});

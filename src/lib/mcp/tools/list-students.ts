import { defineTool } from "@lovable.dev/mcp-js";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "list_students",
  title: "List students",
  description:
    "List all student profiles (name, student number, grade level, section). Staff accounts only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    if (caller.profile.role === "student") {
      return fail("Only teacher or admin accounts can list students.");
    }
    const { data, error } = await caller.supabase
      .from("profiles")
      .select("id, student_id, full_name, grade_level, section, email")
      .eq("role", "student")
      .order("full_name");
    if (error) return fail(`Could not load students: ${error.message}`);
    return ok(data ?? []);
  },
});

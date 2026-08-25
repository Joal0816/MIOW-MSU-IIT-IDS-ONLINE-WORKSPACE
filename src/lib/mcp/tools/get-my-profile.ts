import { defineTool } from "@lovable.dev/mcp-js";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "get_my_profile",
  title: "Get my profile",
  description:
    "Return the signed-in user's own ClassMate Connect school profile, including role, student number, grade level, and section.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    return ok(caller.profile);
  },
});

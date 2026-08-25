import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, resolveCaller } from "../helpers";

export default defineTool({
  name: "list_announcements",
  title: "List announcements",
  description: "List school announcements visible to the signed-in user, newest first.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum announcements to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const caller = await resolveCaller(ctx);
    if (!caller.ok) return fail(caller.message);
    const { data, error } = await caller.supabase
      .from("announcements")
      .select("id, title, content, category, target_audience, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (error) return fail(`Could not load announcements: ${error.message}`);
    return ok(data ?? []);
  },
});

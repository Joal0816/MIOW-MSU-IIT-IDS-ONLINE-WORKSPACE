// Shared helpers for ClassMate Connect MCP tools. Import-safe.
import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

export interface CallerProfile {
  id: string;
  student_id: string | null;
  email: string | null;
  full_name: string;
  role: "student" | "teacher" | "admin";
  grade_level: number | null;
  section: string | null;
}

export type Caller =
  | { ok: true; supabase: ReturnType<typeof supabaseForUser>; profile: CallerProfile }
  | { ok: false; message: string };

// Resolve the caller's school profile from the verified OAuth token's email.
// Never take a user id from tool input — identity always comes from the token.
export async function resolveCaller(ctx: ToolContext): Promise<Caller> {
  if (!ctx.isAuthenticated()) {
    return { ok: false, message: "Not authenticated. Connect with a school account first." };
  }
  const supabase = supabaseForUser(ctx);
  const email = ctx.getUserEmail()?.trim().toLowerCase();
  if (!email) {
    return {
      ok: false,
      message:
        "Your signed-in account has no email address, so it cannot be matched to a school profile.",
    };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id, student_id, email, full_name, role, grade_level, section")
    .ilike("email", email)
    .maybeSingle();
  if (error) return { ok: false, message: `Profile lookup failed: ${error.message}` };
  if (!data) {
    return {
      ok: false,
      message: `No school profile matches ${email}. An administrator must add this email to a profile before MCP tools can be used.`,
    };
  }
  return { ok: true, supabase, profile: data as CallerProfile };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export function ok(payload: unknown, text?: string) {
  return {
    content: [{ type: "text" as const, text: text ?? JSON.stringify(payload, null, 2) }],
    structuredContent: { result: payload },
  };
}

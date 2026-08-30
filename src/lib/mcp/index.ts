import { auth, defineMcp, type McpDefinitionInput } from "@lovable.dev/mcp-js";
import getMyProfileTool from "./tools/get-my-profile";
import listAnnouncementsTool from "./tools/list-announcements";
import listCoursesTool from "./tools/list-courses";
import getMyGradesTool from "./tools/get-my-grades";
import getMyAttendanceTool from "./tools/get-my-attendance";
import listMyAssignmentsTool from "./tools/list-my-assignments";
import submitAssignmentTool from "./tools/submit-assignment";
import listStudentsTool from "./tools/list-students";
import getStudentGradesTool from "./tools/get-student-grades";
import getStudentAttendanceTool from "./tools/get-student-attendance";

// The OAuth issuer MUST be the direct Supabase host, not the .lovable.cloud
// proxy (RFC 8414 issuer mismatch otherwise). The project ref is inlined at
// build time; the fallback keeps the issuer well-formed during the throwaway
// manifest-extract eval, and a token never verifies against the sentinel.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "classmate-connect",
  title: "ClassMate Connect",
  version: "0.1.0",
  instructions:
    "ClassMate Connect school LMS tools, scoped to the signed-in user's school account. " +
    "Students can read their own profile, grades, attendance, and assignments, and submit assignment work. " +
    "Teachers and admins can additionally list students and review any student's grades and attendance. " +
    "Use get_my_profile first to learn the caller's role.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // exactOptionalPropertyTypes makes defineTool's omitted outputSchema clash
  // with the SDK's AnyToolDefinition; cast through the SDK's own input type.
  tools: [
    getMyProfileTool,
    listAnnouncementsTool,
    listCoursesTool,
    getMyGradesTool,
    getMyAttendanceTool,
    listMyAssignmentsTool,
    submitAssignmentTool,
    listStudentsTool,
    getStudentGradesTool,
    getStudentAttendanceTool,
  ] as unknown as McpDefinitionInput["tools"],
});

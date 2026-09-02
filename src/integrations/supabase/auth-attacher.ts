// No-op for local Postgres — Supabase auth is not used.
// App uses custom HMAC session tokens (src/lib/lms.server.ts sessionSecret/createSessionToken).
// Export no-op middleware (must use createMiddleware, not plain function)
import { createMiddleware } from "@tanstack/react-start";
export const attachSupabaseAuth = createMiddleware().server(async ({ next }) => {
  return next();
});

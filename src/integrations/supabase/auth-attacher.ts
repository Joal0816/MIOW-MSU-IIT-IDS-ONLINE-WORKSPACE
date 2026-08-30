// No-op for local Postgres — Supabase auth is not used.
// App uses custom HMAC session tokens (src/lib/lms.server.ts sessionSecret/createSessionToken).
export async function attachSupabaseAuth() {
  // no-op
}

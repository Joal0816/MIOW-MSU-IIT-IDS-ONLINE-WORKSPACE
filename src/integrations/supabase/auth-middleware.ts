// LEGACY SHIM — Supabase auth middleware not used with local Postgres.
// App uses custom HMAC tokens (requireSession). This is a no-op passthrough.
export const requireSupabaseAuth = undefined;
export function createSupabaseMiddleware() {
  return undefined;
}

// LEGACY SHIM — client-side Supabase not used with local Postgres.
// Frontend now talks to server functions only (src/lib/lms.functions.ts).
// This stub keeps old imports from breaking during migration.

export const supabase = new Proxy({} as Record<string, unknown>, {
  get() {
    throw new Error(
      "Supabase client is disabled in local-postgres mode. Use server functions from @/lib/lms instead. " +
        "If you need Supabase, checkout main branch.",
    );
  },
}) as unknown as { auth: unknown; from: unknown; storage: unknown };

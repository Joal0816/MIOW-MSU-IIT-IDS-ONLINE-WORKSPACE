// Client-side Supabase shim.
// When using Supabase backend, this re-exports the client.
// When using local Postgres, this is a no-op — all data goes through server functions.

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] ?? "";
const SUPABASE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";

export const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? (() => {
        // Lazy import to avoid bundling @supabase/supabase-js when not needed
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createClient } = require("@supabase/supabase-js");
        return createClient(SUPABASE_URL, SUPABASE_KEY);
      })()
    : (new Proxy({} as Record<string, unknown>, {
        get() {
          throw new Error(
            "Supabase client not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY, " +
              "or use server functions from @/lib/lms instead.",
          );
        },
      }) as unknown as { auth: unknown; from: unknown; storage: unknown });

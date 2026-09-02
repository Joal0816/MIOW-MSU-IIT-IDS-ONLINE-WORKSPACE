// Shared utilities for server modules — unwrap(), withoutToken(), sleep().

// PostgREST codes that are safe to retry. PGRST303 ("JWT issued at future")
// is a transient gateway clock-skew rejection: the request is refused during
// auth validation BEFORE the query executes, so retrying it can never cause
// a double write, and it clears as soon as the gateway clock passes the
// token's iat.
const RETRYABLE_DB_CODES = new Set(["PGRST303"]);

interface DbError {
  code?: string;
  message?: string;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function unwrap<T>(
  p: PromiseLike<{ data: unknown; error: DbError | null }>,
): Promise<T> {
  let error: DbError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    // supabase-js builders build and dispatch the fetch inside then(), so
    // re-awaiting the same builder is a genuine retry, not a cached replay.
    const res = await p;
    if (!res.error) return res.data as T;
    error = res.error;
    if (!error.code || !RETRYABLE_DB_CODES.has(error.code) || attempt === 2) break;
    await sleep(400 * (attempt + 1));
  }
  console.error("[lms] database error:", {
    code: error?.code,
    message: error?.message,
  });
  throw new Error("Database request failed");
}

/**
 * Strip the session token from a validated payload before it hits PostgREST —
 * no table has a `token` column, so passing it through breaks inserts/updates.
 */
export function withoutToken<T extends { token?: string }>(input: T): Omit<T, "token"> {
  const { token: _ignored, ...row } = input;
  return row;
}

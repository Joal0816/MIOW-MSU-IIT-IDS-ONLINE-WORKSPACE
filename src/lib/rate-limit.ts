// Fixed-window rate limiter — 5 attempts per 15 min per key.
// Default: in-memory (single instance). If REDIS_URL is set and `ioredis`
// is installed, uses Redis with same semantics (cross-instance). Falls back
// to in-memory when Redis is unavailable. For multi-instance prod, set
// REDIS_URL=redis://... to share counters across instances.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Optional Redis backend — lazy loaded so `ioredis` is not a hard dep.
// If REDIS_URL is set and ioredis is installed, counters are shared across
// instances via INCR + PEXPIRE. Otherwise uses in-memory Map (dev / single instance).
let redis: any = null;
let redisWarned = false;
function getRedis(): any {
  const url = process.env.REDIS_URL ?? "";
  if (!url) return null;
  if (redis) return redis;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis");
    redis = new IORedis(url, { maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true });
    redis.on?.("error", (e: unknown) => {
      if (!redisWarned) { console.warn("[rate-limit] Redis error, falling back to in-memory:", e); redisWarned = true; }
    });
    return redis;
  } catch {
    if (!redisWarned) { console.warn("[rate-limit] REDIS_URL set but ioredis not installed — using in-memory. Run: bun add ioredis"); redisWarned = true; }
    return null;
  }
}

type BucketState = { count: number; start: number };

const store = new Map<string, BucketState>();

function getState(key: string): BucketState {
  const now = Date.now();
  const cur = store.get(key);
  if (!cur || now - cur.start >= WINDOW_MS) {
    const next: BucketState = { count: 0, start: now };
    store.set(key, next);
    // opportunistic cleanup to bound memory
    if (store.size > 5000) {
      for (const [k, v] of store) {
        if (now - v.start >= WINDOW_MS) store.delete(k);
      }
      // if still too large, evict oldest
      if (store.size > 5000) {
        const first = store.keys().next().value as string | undefined;
        if (first) store.delete(first);
      }
    }
    return next;
  }
  return cur;
}

export function getBucket(key: string): { consume(): boolean; remaining: number } {
  // If Redis is configured, try sync in-memory as fast-path; the async
  // Redis path is exposed via getBucketAsync below for call sites that can
  // await. Sync callers stay in-memory to avoid breaking existing APIs.
  const r = getRedis();
  if (r) {
    // Fire-and-forget Redis increment for cross-instance visibility, but
    // enforce locally via in-memory to keep this method sync.
    const redisKey = `ratelimit:${key}`;
    r.incr?.(redisKey)?.then?.((count: number) => {
      if (count === 1) r.pexpire?.(redisKey, WINDOW_MS);
    }).catch?.(() => {});
  }
  return {
    consume(): boolean {
      const state = getState(key);
      if (state.count >= MAX_ATTEMPTS) return false;
      state.count += 1;
      return true;
    },
    get remaining(): number {
      const state = store.get(key);
      if (!state) return MAX_ATTEMPTS;
      if (Date.now() - state.start >= WINDOW_MS) return MAX_ATTEMPTS;
      return Math.max(0, MAX_ATTEMPTS - state.count);
    },
  };
}

export async function getBucketAsync(key: string): Promise<{ consume(): Promise<boolean>; remaining: Promise<number> }> {
  const r = getRedis();
  if (!r) return getBucket(key) as unknown as { consume(): Promise<boolean>; remaining: Promise<number> };
  const redisKey = `ratelimit:${key}`;
  return {
    async consume(): Promise<boolean> {
      try {
        const count: number = await r.incr(redisKey);
        if (count === 1) await r.pexpire(redisKey, WINDOW_MS);
        return count <= MAX_ATTEMPTS;
      } catch {
        const state = getState(key);
        if (state.count >= MAX_ATTEMPTS) return false;
        state.count += 1;
        return true;
      }
    },
    async remaining(): Promise<number> {
      try {
        const count: number = await r.get(redisKey).then((v: string | null) => parseInt(v ?? "0", 10));
        return Math.max(0, MAX_ATTEMPTS - count);
      } catch {
        const state = store.get(key);
        if (!state) return MAX_ATTEMPTS;
        if (Date.now() - state.start >= WINDOW_MS) return MAX_ATTEMPTS;
        return Math.max(0, MAX_ATTEMPTS - state.count);
      }
    },
  };
}

// Test helper — clear all buckets.
export function _clearRateLimitStore(): void {
  store.clear();
}

export const RATE_LIMIT_MAX_ATTEMPTS = MAX_ATTEMPTS;
export const RATE_LIMIT_WINDOW_MS = WINDOW_MS;

// In-memory fixed-window rate limiter — 5 attempts per 15 min per key.
// Used for brute-force protection on PIN / password verification. Per-instance
// only; for multi-instance scale replace with Redis or edge limiter.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

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

// Test helper — clear all buckets.
export function _clearRateLimitStore(): void {
  store.clear();
}

export const RATE_LIMIT_MAX_ATTEMPTS = MAX_ATTEMPTS;
export const RATE_LIMIT_WINDOW_MS = WINDOW_MS;

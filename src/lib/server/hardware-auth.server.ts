import { timingSafeEqual } from "node:crypto";

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const _rate = new Map<string, number[]>();

export function hitRateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (_rate.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  _rate.set(ip, hits);
  if (_rate.size > 1000) {
    for (const [k, v] of _rate) {
      const last = v[v.length - 1];
      if (!v.length || (last != null && now - last > RATE_LIMIT_WINDOW_MS)) _rate.delete(k);
    }
  }
  return hits.length > RATE_LIMIT_MAX;
}

export function authorized(request: Request): boolean {
  const expected = process.env["HARDWARE_API_KEY"];
  if (!expected) return false;
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const tsRaw = request.headers.get("x-hardware-timestamp");
  if (!tsRaw) return false;
  const ts = Date.parse(tsRaw);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function guardHardwareRequest(
  request: Request,
): { ok: true; ip: string } | { ok: false; response: Response } {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (hitRateLimit(ip)) {
    return {
      ok: false,
      response: new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      }),
    };
  }
  if (!authorized(request)) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }
  return { ok: true, ip };
}

import { describe, it, expect, beforeEach, afterEach } from "bun:test";

process.env["SUPABASE_URL"] ??= "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] ??= "test-service-role-key-1234567890abcdef";
process.env["SUPABASE_PUBLISHABLE_KEY"] ??= "test-publishable-key";

process.env["HARDWARE_API_KEY"] = "test-key-123";

import { hitRateLimit, authorized, guardHardwareRequest } from "./hardware-auth.server";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/hardware", { headers });
}

function validTimestamp(): string {
  return new Date().toISOString();
}

describe("hitRateLimit", () => {
  it("returns false when under the limit", () => {
    for (let i = 0; i < 10; i++) {
      expect(hitRateLimit("rl-ok")).toBe(false);
    }
  });

  it("returns true after exceeding 60 requests", () => {
    for (let i = 0; i < 60; i++) {
      hitRateLimit("rl-exceed");
    }
    expect(hitRateLimit("rl-exceed")).toBe(true);
  });

  it("uses separate counters per IP", () => {
    for (let i = 0; i < 60; i++) {
      hitRateLimit("rl-a");
    }
    expect(hitRateLimit("rl-a")).toBe(true);
    expect(hitRateLimit("rl-b")).toBe(false);
  });
});

describe("authorized", () => {
  it("returns true with correct Bearer token and valid timestamp", () => {
    const req = makeRequest({
      Authorization: "Bearer test-key-123",
      "X-Hardware-Timestamp": validTimestamp(),
    });
    expect(authorized(req)).toBe(true);
  });

  it("returns false with wrong Bearer token", () => {
    const req = makeRequest({
      Authorization: "Bearer wrong-key",
      "X-Hardware-Timestamp": validTimestamp(),
    });
    expect(authorized(req)).toBe(false);
  });

  it("returns false with expired timestamp (>5 min old)", () => {
    const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const req = makeRequest({
      Authorization: "Bearer test-key-123",
      "X-Hardware-Timestamp": old,
    });
    expect(authorized(req)).toBe(false);
  });

  it("returns false with future timestamp (>5 min ahead)", () => {
    const future = new Date(Date.now() + 6 * 60 * 1000).toISOString();
    const req = makeRequest({
      Authorization: "Bearer test-key-123",
      "X-Hardware-Timestamp": future,
    });
    expect(authorized(req)).toBe(false);
  });

  it("returns false when Authorization header is missing", () => {
    const req = makeRequest({ "X-Hardware-Timestamp": validTimestamp() });
    expect(authorized(req)).toBe(false);
  });

  it("returns false when X-Hardware-Timestamp header is missing", () => {
    const req = makeRequest({ Authorization: "Bearer test-key-123" });
    expect(authorized(req)).toBe(false);
  });

  it("returns false with unparseable timestamp", () => {
    const req = makeRequest({
      Authorization: "Bearer test-key-123",
      "X-Hardware-Timestamp": "not-a-date",
    });
    expect(authorized(req)).toBe(false);
  });

  it("returns false when HARDWARE_API_KEY env is not set", () => {
    const orig = process.env["HARDWARE_API_KEY"];
    delete process.env["HARDWARE_API_KEY"];
    const req = makeRequest({
      Authorization: "Bearer test-key-123",
      "X-Hardware-Timestamp": validTimestamp(),
    });
    expect(authorized(req)).toBe(false);
    process.env["HARDWARE_API_KEY"] = orig;
  });
});

describe("guardHardwareRequest", () => {
  it("returns { ok: true, ip } for a valid request", () => {
    const req = makeRequest({
      Authorization: "Bearer test-key-123",
      "X-Hardware-Timestamp": validTimestamp(),
      "X-Forwarded-For": "10.0.0.1",
    });
    const result = guardHardwareRequest(req);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ip).toBe("10.0.0.1");
  });

  it("returns 401 for unauthorized requests", () => {
    const req = makeRequest({
      "X-Hardware-Timestamp": validTimestamp(),
    });
    const result = guardHardwareRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns 429 when rate limit is exceeded", () => {
    const req = makeRequest({
      Authorization: "Bearer test-key-123",
      "X-Hardware-Timestamp": validTimestamp(),
      "X-Forwarded-For": "10.99.99.99",
    });
    for (let i = 0; i < 60; i++) {
      guardHardwareRequest(
        makeRequest({
          Authorization: "Bearer test-key-123",
          "X-Hardware-Timestamp": validTimestamp(),
          "X-Forwarded-For": "10.99.99.99",
        }),
      );
    }
    const result = guardHardwareRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("60");
    }
  });

  it("extracts IP from X-Real-Header when X-Forwarded-For is absent", () => {
    const req = makeRequest({
      Authorization: "Bearer test-key-123",
      "X-Hardware-Timestamp": validTimestamp(),
      "X-Real-Ip": "192.168.1.50",
    });
    const result = guardHardwareRequest(req);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ip).toBe("192.168.1.50");
  });

  it("falls back to 'unknown' when no IP headers present", () => {
    const req = makeRequest({
      Authorization: "Bearer test-key-123",
      "X-Hardware-Timestamp": validTimestamp(),
    });
    const result = guardHardwareRequest(req);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ip).toBe("unknown");
  });
});

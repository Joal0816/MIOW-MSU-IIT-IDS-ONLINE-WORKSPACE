import { describe, it, expect, beforeEach, afterEach } from "bun:test";

process.env["SUPABASE_URL"] ??= "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] ??= "test-service-role-key-1234567890abcdef";
process.env["SUPABASE_PUBLISHABLE_KEY"] ??= "test-publishable-key";

describe("sessions.server edge cases", () => {
  const origSessionSecret = process.env["SESSION_SECRET"];
  const origServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  afterEach(() => {
    if (origSessionSecret === undefined) delete process.env["SESSION_SECRET"];
    else process.env["SESSION_SECRET"] = origSessionSecret;
    if (origServiceKey === undefined) delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    else process.env["SUPABASE_SERVICE_ROLE_KEY"] = origServiceKey;
  });

  describe("sessionSecret", () => {
    it("returns SESSION_SECRET when set", async () => {
      process.env["SESSION_SECRET"] = "my-secret-32-hex-1234567890abcdef";
      const { sessionSecret } = await import("./sessions.server");
      expect(sessionSecret()).toBe("my-secret-32-hex-1234567890abcdef");
    });

    it("throws when SESSION_SECRET is missing", async () => {
      delete process.env["SESSION_SECRET"];
      const { sessionSecret } = await import("./sessions.server");
      expect(() => sessionSecret()).toThrow("Missing SESSION_SECRET");
    });

    it("does not fall back to SUPABASE_SERVICE_ROLE_KEY", async () => {
      delete process.env["SESSION_SECRET"];
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-key-1234567890abcdef1234";
      const { sessionSecret } = await import("./sessions.server");
      expect(() => sessionSecret()).toThrow("Missing SESSION_SECRET");
    });
  });

  describe("verifySessionToken edge cases", () => {
    it("rejects token with missing sub field", async () => {
      process.env["SESSION_SECRET"] = "edge-case-secret-1234567890abcdef1234";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "other-key-1234567890abcdef1234";

      const { verifySessionToken } = await import("./sessions.server");
      const { createHmac } = await import("node:crypto");

      const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 3600000 })).toString(
        "base64url",
      );
      const sig = createHmac("sha256", process.env["SESSION_SECRET"]!)
        .update(payload)
        .digest("base64url");
      expect(() => verifySessionToken(`${payload}.${sig}`)).toThrow("Unauthorized");
    });

    it("rejects token with non-string jti", async () => {
      process.env["SESSION_SECRET"] = "jti-test-secret-1234567890abcdef1234";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "other-key-1234567890abcdef1234";

      const { verifySessionToken } = await import("./sessions.server");
      const { createHmac } = await import("node:crypto");

      const payload = Buffer.from(
        JSON.stringify({
          sub: "user-1",
          jti: 12345,
          exp: Date.now() + 3600000,
        }),
      ).toString("base64url");
      const sig = createHmac("sha256", process.env["SESSION_SECRET"]!)
        .update(payload)
        .digest("base64url");
      expect(() => verifySessionToken(`${payload}.${sig}`)).toThrow("Unauthorized");
    });

    it("rejects token with missing dot separator", async () => {
      process.env["SESSION_SECRET"] = "sep-test-secret-1234567890abcdef1234";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "other-key-1234567890abcdef1234";

      const { verifySessionToken } = await import("./sessions.server");
      expect(() => verifySessionToken("noseparator")).toThrow("Unauthorized");
    });

    it("rejects empty string token", async () => {
      process.env["SESSION_SECRET"] = "empty-test-secret-1234567890abcdef";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "other-key-1234567890abcdef";

      const { verifySessionToken } = await import("./sessions.server");
      expect(() => verifySessionToken("")).toThrow("Unauthorized");
    });
  });

  describe("createSessionToken", () => {
    it("returns a token with payload.signature format", async () => {
      process.env["SESSION_SECRET"] = "create-test-secret-1234567890abcdef";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "other-key-1234567890abcdef1234";

      const { createSessionToken } = await import("./sessions.server");
      const token = createSessionToken("user-abc");
      const parts = token.split(".");
      expect(parts.length).toBe(2);
      expect(parts[0]!.length).toBeGreaterThan(0);
      expect(parts[1]!.length).toBeGreaterThan(0);
    });

    it("accepts a custom jti parameter", async () => {
      process.env["SESSION_SECRET"] = "jti-custom-secret-1234567890abcdef";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "other-key-1234567890abcdef1234";

      const { createSessionToken, verifySessionToken } = await import("./sessions.server");
      const token = createSessionToken("user-custom", "my-custom-jti");
      const payload = token.split(".")[0]!;
      const body = JSON.parse(Buffer.from(payload, "base64url").toString());
      expect(body.jti).toBe("my-custom-jti");
      expect(verifySessionToken(token)).toBe("user-custom");
    });
  });
});

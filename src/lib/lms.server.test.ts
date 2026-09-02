// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createHmac } from "node:crypto";

// Ensure Supabase env exists before importing server module (client.server.ts validates at import)
process.env["SUPABASE_URL"] ??= "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] ??= "test-service-role-key-1234567890abcdef";
process.env["SUPABASE_PUBLISHABLE_KEY"] ??= "test-publishable-key";

describe("lms.server session HMAC — SESSION_SECRET isolation with compat", () => {
  const origSessionSecret = process.env["SESSION_SECRET"];
  const origServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  afterEach(() => {
    if (origSessionSecret === undefined) delete process.env["SESSION_SECRET"];
    else process.env["SESSION_SECRET"] = origSessionSecret;
    if (origServiceKey === undefined) delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    else process.env["SUPABASE_SERVICE_ROLE_KEY"] = origServiceKey;
  });

  it("createSessionToken uses SESSION_SECRET and verifySessionToken accepts it", async () => {
    process.env["SESSION_SECRET"] = "test-session-secret-32-chars-hex-1234567890ab";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "other-service-key-abcdef1234567890";

    const { createSessionToken, verifySessionToken } = await import("./lms.server.ts");

    const token = createSessionToken("00000000-0000-4000-a000-000000000001");
    expect(token).toContain(".");

    // Must verify with current SESSION_SECRET
    const sub = verifySessionToken(token);
    expect(sub).toBe("00000000-0000-4000-a000-000000000001");

    // Manually verify signature was made with SESSION_SECRET, not service key
    const [payload, sig] = token.split(".");
    const expectedNew = createHmac("sha256", process.env["SESSION_SECRET"]!)
      .update(payload!)
      .digest("base64url");
    const expectedOld = createHmac("sha256", process.env["SUPABASE_SERVICE_ROLE_KEY"]!)
      .update(payload!)
      .digest("base64url");
    expect(sig).toBe(expectedNew);
    expect(sig).not.toBe(expectedOld);
  });

  it("verifySessionToken accepts old tokens signed with SUPABASE_SERVICE_ROLE_KEY (compat)", async () => {
    const newSecret = "new-session-secret-32-hex-abcdef1234567890";
    const oldKey = "old-service-role-key-compat-test-123456";
    process.env["SESSION_SECRET"] = newSecret;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = oldKey;

    // Need fresh import to pick up new env for sessionSecret()
    // Use dynamic import with cache bust via query param
    const mod = await import("./lms.server.ts");
    const { verifySessionToken } = mod;

    // Create an old token manually signed with the old service key (as pre-migration tokens were)
    const profileId = "00000000-0000-4000-a000-000000000002";
    const payload = Buffer.from(
      JSON.stringify({ sub: profileId, exp: Date.now() + 12 * 60 * 60 * 1000 }),
    ).toString("base64url");
    const sigOld = createHmac("sha256", oldKey).update(payload).digest("base64url");
    const oldToken = `${payload}.${sigOld}`;

    // New module's verify should accept oldToken via fallback key loop
    const sub = verifySessionToken(oldToken);
    expect(sub).toBe(profileId);

    // Also new tokens still verify
    const { createSessionToken } = mod;
    const newToken = createSessionToken(profileId);
    expect(verifySessionToken(newToken)).toBe(profileId);
  });

  it("falls back to SUPABASE_SERVICE_ROLE_KEY when SESSION_SECRET is unset", async () => {
    delete process.env["SESSION_SECRET"];
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "fallback-service-key-1234567890abcdef";

    const { createSessionToken, verifySessionToken } = await import("./lms.server.ts");
    const token = createSessionToken("00000000-0000-4000-a000-000000000003");
    expect(verifySessionToken(token)).toBe("00000000-0000-4000-a000-000000000003");
  });

  it("rejects tampered or expired tokens", async () => {
    process.env["SESSION_SECRET"] = "tamper-test-secret-32-hex-1234567890ab";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "other-key-for-tamper";

    const { createSessionToken, verifySessionToken } = await import("./lms.server.ts");
    const token = createSessionToken("00000000-0000-4000-a000-000000000004");
    const [payload, sig] = token.split(".");

    // Tampered signature
    expect(() => verifySessionToken(`${payload}.invalidsig`)).toThrow("Unauthorized");
    // Missing part
    expect(() => verifySessionToken("invalid")).toThrow("Unauthorized");

    // Expired payload signed with correct key should also throw on exp check
    const expiredPayload = Buffer.from(
      JSON.stringify({ sub: "00000000-0000-4000-a000-000000000004", exp: Date.now() - 1000 }),
    ).toString("base64url");
    const expiredSig = createHmac("sha256", process.env["SESSION_SECRET"]!)
      .update(expiredPayload)
      .digest("base64url");
    expect(() => verifySessionToken(`${expiredPayload}.${expiredSig}`)).toThrow("Unauthorized");
  });
});

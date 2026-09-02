/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

process.env["SUPABASE_URL"] ??= "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] ??= "test-service-role-key-1234567890abcdef";
process.env["SUPABASE_PUBLISHABLE_KEY"] ??= "test-publishable-key";

import { unwrap, withoutToken, sleep } from "./utils.server";

describe("sleep", () => {
  it("resolves after the specified delay", async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe("unwrap", () => {
  it("resolves with data on success", async () => {
    const promise = Promise.resolve({ data: { id: 1, name: "test" }, error: null });
    const result = await unwrap(promise);
    expect(result).toEqual({ id: 1, name: "test" });
  });

  it("retries on PGRST303 error and resolves on subsequent success", async () => {
    let callCount = 0;
    const builder = {
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        callCount++;
        if (callCount <= 2) {
          resolve({ data: null, error: { code: "PGRST303", message: "clock skew" } });
        } else {
          resolve({ data: { ok: true }, error: null });
        }
        return builder;
      },
    };
    const result = await unwrap(builder as any);
    expect(result).toEqual({ ok: true });
    expect(callCount).toBe(3);
  });

  it("throws 'Database request failed' after exhausting retries on PGRST303", async () => {
    const builder = {
      then(resolve: (v: unknown) => void) {
        resolve({ data: null, error: { code: "PGRST303", message: "clock skew" } });
        return builder;
      },
    };
    await expect(unwrap(builder as any)).rejects.toThrow("Database request failed");
  });

  it("throws 'Database request failed' on non-retryable error (no code)", async () => {
    const promise = Promise.resolve({
      data: null,
      error: { message: "something broke" },
    });
    await expect(unwrap(promise)).rejects.toThrow("Database request failed");
  });

  it("throws 'Database request failed' on non-retryable error code", async () => {
    const promise = Promise.resolve({
      data: null,
      error: { code: "42P01", message: "undefined_table" },
    });
    await expect(unwrap(promise)).rejects.toThrow("Database request failed");
  });
});

describe("withoutToken", () => {
  it("removes the token property", () => {
    const input = { id: "123", name: "Alice", token: "secret-tok" };
    const result = withoutToken(input);
    expect(result).toEqual({ id: "123", name: "Alice" });
    expect((result as any).token).toBeUndefined();
  });

  it("returns the same shape when no token property exists", () => {
    const input = { id: "456", name: "Bob" } as { token?: string };
    const result = withoutToken(input);
    expect(result).toEqual({ id: "456", name: "Bob" });
  });

  it("preserves other properties including nested objects", () => {
    const input = { id: "789", nested: { a: 1 }, token: "x", extra: true };
    const result = withoutToken(input);
    expect(result).toEqual({ id: "789", nested: { a: 1 }, extra: true });
  });

  it("strips an undefined token without removing it from the type (runtime check)", () => {
    const input: { id: string; token?: string } = { id: "abc" };
    const result = withoutToken(input);
    expect(result).toEqual({ id: "abc" });
  });
});

import { describe, it, expect } from "bun:test";
import { cn } from "./utils";

describe("cn", () => {
  it("merges a single class", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles falsy values", () => {
    expect(cn("foo", false, null, undefined, 0, "")).toBe("foo");
  });

  it("concatenates identical classes", () => {
    expect(cn("foo", "foo")).toBe("foo foo");
  });

  it("resolves tailwind conflicts — later wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("merges conditional classes", () => {
    const active = true;
    const disabled = false;
    expect(cn("base", active && "active", disabled && "disabled")).toBe("base active");
  });

  it("handles arrays", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
    expect(cn(["p-2", "p-4"])).toBe("p-4");
  });

  it("handles objects", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
    expect(cn({ "p-2": false, "p-4": true })).toBe("p-4");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles empty string inputs", () => {
    expect(cn("", "foo", "")).toBe("foo");
  });
});

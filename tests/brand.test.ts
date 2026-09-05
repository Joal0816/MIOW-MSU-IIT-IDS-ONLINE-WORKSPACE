import {
  APP_COMPACT_NAME,
  APP_DESCRIPTOR,
  APP_NAME,
  APP_SHORT_NAME,
  BRAND_LOGO_SRC,
  NOTIFICATION_SIGNOFF,
} from "@/lib/brand";
import { describe, expect, it } from "bun:test";

describe("MIOW brand retained — src/lib/brand.ts is single source of truth", () => {
  it('APP_NAME is "INTEGRATED DEVELOPMENTAL SCHOOL ONLINE WORKSPACE (MIOW)"', () => {
    expect(APP_NAME).toBe("INTEGRATED DEVELOPMENTAL SCHOOL ONLINE WORKSPACE (MIOW)");
  });

  it('APP_SHORT_NAME is "MIOW"', () => {
    expect(APP_SHORT_NAME).toBe("MIOW");
  });

  it('NOTIFICATION_SIGNOFF contains "MIOW Administration Team"', () => {
    expect(NOTIFICATION_SIGNOFF).toContain("MIOW Administration Team");
  });

  it('BRAND_LOGO_SRC is "/miow-logo.svg"', () => {
    expect(BRAND_LOGO_SRC).toBe("/miow-logo.svg");
  });

  it('APP_COMPACT_NAME is "IDS"', () => {
    expect(APP_COMPACT_NAME).toBe("IDS");
  });

  it("APP_DESCRIPTOR does not contain G7-College brand leakage", () => {
    expect(APP_DESCRIPTOR).toBe("INTEGRATED DEVELOPMENTAL SCHOOL ONLINE WORKSPACE");
    expect(APP_NAME).toMatch(/MIOW/);
    // ensure no accidental rebrand to G7-College
    expect(APP_NAME.includes("G7")).toBe(false);
    expect(APP_SHORT_NAME.includes("G7")).toBe(false);
    expect(BRAND_LOGO_SRC.includes("g7")).toBe(false);
  });
});

import { describe, it, expect } from "bun:test";

process.env["SUPABASE_URL"] ??= "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] ??= "test-service-role-key-1234567890abcdef";
process.env["SUPABASE_PUBLISHABLE_KEY"] ??= "test-publishable-key";

import { materialUrlForPath } from "./materials.server";

describe("materialUrlForPath", () => {
  it("encodes a simple path into a query parameter", () => {
    const result = materialUrlForPath("course-123/material_123.pdf");
    expect(result).toBe("/api/public/material?p=course-123%2Fmaterial_123.pdf");
  });

  it("encodes paths with spaces", () => {
    const result = materialUrlForPath("my course/file name.pdf");
    expect(result).toBe("/api/public/material?p=my%20course%2Ffile%20name.pdf");
  });

  it("encodes paths with special characters", () => {
    const result = materialUrlForPath("course/material&test=1.pdf");
    expect(result).toContain("/api/public/material?p=");
    expect(result).toContain("material%26test%3D1.pdf");
  });

  it("handles empty path", () => {
    const result = materialUrlForPath("");
    expect(result).toBe("/api/public/material?p=");
  });

  it("preserves forward slashes via encoding", () => {
    const result = materialUrlForPath("a/b/c/file.pdf");
    expect(result).toBe("/api/public/material?p=a%2Fb%2Fc%2Ffile.pdf");
  });
});

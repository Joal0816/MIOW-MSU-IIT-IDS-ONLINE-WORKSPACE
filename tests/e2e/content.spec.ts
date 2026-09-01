import { test, expect } from "@playwright/test";

test.describe("MIOW – Announcements & Worksheets UI", () => {
  test("public assets: og-cover does not point to lovable", async ({ page }) => {
    await page.goto("/");
    const content = await page.content();
    expect(content).not.toContain("lovable.app");
    expect(content).not.toContain("lovableproject");
  });

  test("vite build output has no lovable in html", async ({ request }) => {
    const res = await request.get("/");
    const html = await res.text();
    expect(html.toLowerCase()).not.toContain("lovable");
  });
});

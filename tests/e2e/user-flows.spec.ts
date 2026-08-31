import { test, expect } from "@playwright/test";

const ADMIN = { login: "ana.reyes@northview.edu", pin: "0000" };
const TEACHER = { login: "maria.santos@northview.edu", pin: "1111" };
const STUDENT = { login: "juan.delacruz@student.northview.edu", pin: "1234" };

async function loginViaPin(page: any, login: string, pin: string) {
  await page.goto("/auth");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/auth");
  await expect(page.locator("body")).toContainText("MIOW", { timeout: 15000 });
  await page.waitForTimeout(1000);
  const pinTab = page.getByRole("button", { name: /PIN Login/ });
  await expect(pinTab).toBeVisible({ timeout: 15000 });
  await pinTab.click();
  await page.waitForTimeout(800);
  await expect(page.locator("#login-id")).toBeVisible({ timeout: 15000 });
  await page.locator("#login-id").fill(login);
  await page.locator("#login-pin").fill(pin);
  await page.getByRole("button", { name: /Continue to face verification/ }).click();
  const body = page.locator("body");
  await expect(async () => {
    const txt = await body.textContent();
    if (/Sign-in failed|Invalid credentials|Too many attempts/.test(txt || ""))
      throw new Error("pinLogin rejected");
    if (!/Locating face|Matching biometrics|Liveness check|Identity confirmed/.test(txt || ""))
      throw new Error("waiting for face verification");
  }).toPass({ timeout: 15000 });
  await page.waitForURL(/\/dashboard\/(admin|teacher|student)/, { timeout: 20000 });
  await page.waitForTimeout(1000);
}

// All PIN login tests require real DB — skip in mock mode
const describeRealDB = process.env.PLAYWRIGHT_REAL_DB || process.env.DATABASE_URL ? test.describe : test.describe.skip;

describeRealDB("Admin — PIN login", () => {
  test.setTimeout(60000);
  test("admin logs in via PIN and sees Campus Overview", async ({ page }) => {
    await loginViaPin(page, ADMIN.login, ADMIN.pin);
    await expect(page).toHaveURL(/\/dashboard\/admin/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText("Campus Overview", { timeout: 15000 });
  });
});

describeRealDB("Teacher — PIN login", () => {
  test.setTimeout(60000);
  test("teacher logs in via PIN and sees Teacher Dashboard", async ({ page }) => {
    await loginViaPin(page, TEACHER.login, TEACHER.pin);
    await expect(page).toHaveURL(/\/dashboard\/teacher/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText("Teacher Dashboard", { timeout: 15000 });
  });
});

describeRealDB("Student — PIN login", () => {
  test.setTimeout(60000);
  test("student logs in via PIN and sees Student Dashboard", async ({ page }) => {
    await loginViaPin(page, STUDENT.login, STUDENT.pin);
    await expect(page).toHaveURL(/\/dashboard\/student/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText(/Student Dashboard|Welcome/i, { timeout: 15000 });
  });
  test("student can also login via student_id", async ({ page }) => {
    await loginViaPin(page, "2024-0001", "1234");
    await expect(page).toHaveURL(/\/dashboard\/student/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText(/Student Dashboard/i, { timeout: 15000 });
  });
});

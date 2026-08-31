import { test, expect } from "@playwright/test";

// Uses Dev Launcher (dev-only) for fast, reliable navigation flows.
// One dedicated test at the bottom verifies real PIN login via remote PG.
const SESSION_KEY = "northview-lms-session";

function devProfile(role: "admin" | "teacher" | "student") {
  const base = {
    id: `dev-${role}-0001`,
    student_id: role === "student" ? "2024-0001" : null,
    email: `${role}@miow.dev`,
    pin: null,
    full_name: role === "admin" ? "Dev Admin" : role === "teacher" ? "Dev Teacher" : "Dev Student",
    role,
    rfid_uid: null,
    avatar_url: null,
    face_embedding: null,
    grade_level: role === "student" ? 10 : null,
    section: null,
    created_at: new Date().toISOString(),
    employee_id: role !== "student" ? `DEV-${role.toUpperCase()}-01` : null,
    department: role !== "student" ? "IDS" : null,
    session_token: `dev-bypass-token-${role}`,
    has_pin: true,
    has_rfid: false,
  };
  return base;
}

async function loginViaLauncher(page: any, role: "admin" | "teacher" | "student") {
  await page.goto("/");
  await expect(page.locator("body")).toContainText("MIOW Dev Launcher", { timeout: 15000 });
  const label = role === "admin" ? "Enter as Admin" : role === "teacher" ? "Enter as Teacher" : "Enter as Student";
  const btn = page.getByRole("button", { name: label });
  await expect(btn).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(600);
  await btn.click();
  const expected = role === "admin" ? "/dashboard/admin" : role === "teacher" ? "/dashboard/teacher" : "/dashboard/student";
  await expect(page).toHaveURL(expected, { timeout: 15000 });
  await page.waitForTimeout(800);
}

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
  await expect(page.locator("body")).toContainText(/Locating face|Matching biometrics|Liveness check|Identity confirmed/, { timeout: 15000 });
  await page.waitForURL(/\/dashboard\/(admin|teacher|student)/, { timeout: 20000 });
  await page.waitForTimeout(1000);
}

// ── Admin flow (launcher) ──────────────────────────────────────────
test.describe("User Flows — Admin (launcher)", () => {
  test.setTimeout(60000);
  test("admin sees Campus Overview", async ({ page }) => {
    await loginViaLauncher(page, "admin");
    await expect(page.locator("body")).toContainText("Campus Overview", { timeout: 15000 });
    await expect(page.locator("body")).toContainText("Students");
    await expect(page.locator("body")).toContainText(/Courses|Announcements/);
  });
  test("admin navigates Students / Teachers / Courses / Announcements", async ({ page }) => {
    await loginViaLauncher(page, "admin");
    await page.goto("/dashboard/admin/students");
    await expect(page.locator("body")).toContainText(/Students|Manage Students/, { timeout: 15000 });
    await page.goto("/dashboard/admin/teachers");
    await expect(page.locator("body")).toContainText(/Teachers|Faculty/, { timeout: 15000 });
    await page.goto("/dashboard/admin/courses");
    await expect(page.locator("body")).toContainText(/Courses/, { timeout: 15000 });
    await expect(page.locator("body")).toContainText(/Grade|College|Level|Create/i);
    await page.goto("/dashboard/admin/announcements");
    await expect(page.locator("body")).toContainText(/Announcements/, { timeout: 15000 });
  });
  test("admin sees attendance and settings", async ({ page }) => {
    await loginViaLauncher(page, "admin");
    await page.goto("/dashboard/admin/attendance");
    await expect(page.locator("body")).toContainText(/Attendance|Kiosk|Tap/i, { timeout: 15000 });
    await page.goto("/dashboard/admin/settings");
    await expect(page.locator("body")).toContainText(/Settings/, { timeout: 15000 });
  });
});

// ── Teacher flow (launcher) ────────────────────────────────────────
test.describe("User Flows — Teacher (launcher)", () => {
  test.setTimeout(60000);
  test("teacher sees Teacher Dashboard", async ({ page }) => {
    await loginViaLauncher(page, "teacher");
    await expect(page.locator("body")).toContainText("Teacher Dashboard", { timeout: 15000 });
    await expect(page.locator("body")).toContainText(/My Courses|Students/);
  });
  test("teacher views Students Info and Courses", async ({ page }) => {
    await loginViaLauncher(page, "teacher");
    await page.goto("/dashboard/teacher/students");
    await expect(page.locator("body")).toContainText(/Students|Students Info/i, { timeout: 15000 });
    await page.goto("/dashboard/admin/courses");
    await expect(page.locator("body")).toContainText(/Courses/, { timeout: 15000 });
  });
  test("teacher sees Gradebook and Attendance", async ({ page }) => {
    await loginViaLauncher(page, "teacher");
    await page.goto("/dashboard/admin/grades");
    await expect(page.locator("body")).toContainText(/Gradebook|Grades/i, { timeout: 15000 });
    await page.goto("/dashboard/admin/attendance");
    await expect(page.locator("body")).toContainText(/Attendance|Kiosk/i, { timeout: 15000 });
  });
});

// ── Student flow (launcher) ────────────────────────────────────────
test.describe("User Flows — Student (launcher)", () => {
  test.setTimeout(60000);
  test("student sees Student Dashboard", async ({ page }) => {
    await loginViaLauncher(page, "student");
    await expect(page.locator("body")).toContainText(/Student Dashboard|Welcome/i, { timeout: 15000 });
  });
  test("student browses Activities, Worksheets, Grades, Attendance", async ({ page }) => {
    await loginViaLauncher(page, "student");
    await page.goto("/dashboard/student/assignments");
    await expect(page.locator("body")).toContainText(/Activities|Assignments/i, { timeout: 15000 });
    await page.goto("/dashboard/student/quizzes");
    await expect(page.locator("body")).toContainText(/Worksheets/, { timeout: 15000 });
    await page.goto("/dashboard/student/grades");
    await expect(page.locator("body")).toContainText(/Grades|Grade/i, { timeout: 15000 });
    await page.goto("/dashboard/student/attendance");
    await expect(page.locator("body")).toContainText(/Attendance/i, { timeout: 15000 });
  });
  test("student can login via student_id as well (real DB smoke)", async ({ page }) => {
    // This one uses real DB PIN login to prove remote PG is wired.
    // If it flakes due to dev server timing, it will retry; launcher tests above already prove navigation.
    await loginViaPin(page, "2024-0001", "1234");
    await expect(page).toHaveURL(/\/dashboard\/student/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText(/Student Dashboard/i, { timeout: 15000 });
  });
});

// ── Real DB Pin login smoke (single) ───────────────────────────────
test.describe("Real DB — PIN login (remote PG)", () => {
  test.setTimeout(60000);
  test("admin PIN login via remote PG works", async ({ page }) => {
    await loginViaPin(page, "ana.reyes@northview.edu", "0000");
    await expect(page).toHaveURL(/\/dashboard\/admin/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText("Campus Overview", { timeout: 15000 });
  });
  test("teacher PIN login works", async ({ page }) => {
    await loginViaPin(page, "maria.santos@northview.edu", "1111");
    await expect(page).toHaveURL(/\/dashboard\/teacher/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText("Teacher Dashboard", { timeout: 15000 });
  });
  test("student PIN login works", async ({ page }) => {
    await loginViaPin(page, "juan.delacruz@student.northview.edu", "1234");
    await expect(page).toHaveURL(/\/dashboard\/student/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText(/Student Dashboard/, { timeout: 15000 });
  });
});

// ── Guards ─────────────────────────────────────────────────────────
test.describe("Guards — cross-role", () => {
  test("student cannot access /dashboard/admin", async ({ page }) => {
    await loginViaLauncher(page, "student");
    await page.goto("/dashboard/admin");
    await expect(page).toHaveURL(/\/dashboard\/student/, { timeout: 15000 });
  });
  test("teacher can access admin courses, student cannot", async ({ page }) => {
    await loginViaLauncher(page, "teacher");
    await page.goto("/dashboard/admin/courses");
    await expect(page.locator("body")).toContainText(/Courses/, { timeout: 15000 });
    // Switch to student
    await page.evaluate(() => localStorage.clear());
    await loginViaLauncher(page, "student");
    await page.goto("/dashboard/admin/courses");
    await expect(page).toHaveURL(/\/dashboard\/student/, { timeout: 15000 });
  });
});

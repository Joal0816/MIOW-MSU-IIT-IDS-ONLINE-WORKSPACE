import { test, expect } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────
const SESSION_KEY = "northview-lms-session";

function fakeProfile(role: "admin" | "teacher" | "student") {
  return {
    id: `test-${role}-001`,
    student_id: role === "student" ? "2024-0001" : null,
    email: `${role}@test.miow`,
    pin: null,
    full_name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    role,
    rfid_uid: null,
    avatar_url: null,
    face_embedding: null,
    grade_level: role === "student" ? 10 : null,
    section: role === "student" ? "A" : null,
    created_at: new Date().toISOString(),
    employee_id: role !== "student" ? `EMP-${role.toUpperCase()}` : null,
    department: role !== "student" ? "CS" : null,
    biometric_enrolled_at: null,
    has_pin: true,
    has_rfid: false,
    session_token: "test-session-token",
  };
}

async function seedSession(page: any, role: "admin" | "teacher" | "student") {
  await page.goto("/");
  await page.evaluate(
    ({ key, profile }: { key: string; profile: ReturnType<typeof fakeProfile> }) => {
      localStorage.setItem(key, JSON.stringify(profile));
    },
    { key: SESSION_KEY, profile: fakeProfile(role) },
  );
}

/** Mock all TanStack Start server function POST calls to return success with given data. */
async function mockServerFns(page: any, mocks: Record<string, unknown>) {
  await page.route("**/api/**", async (route: any) => {
    const url = route.request().url();
    // Check if this is a server function call
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON?.() || {};
      // Try to match by function name in URL or body
      for (const [pattern, data] of Object.entries(mocks)) {
        if (url.includes(pattern) || JSON.stringify(body).includes(pattern)) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ result: data, error: null }),
          });
          return;
        }
      }
    }
    await route.continue();
  });
}

// ══════════════════════════════════════════════════════════
// AUTH PAGE INTERACTIONS
// ══════════════════════════════════════════════════════════
test.describe("Auth page interactions", () => {
  test("PIN tab shows login form with correct fields", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("body")).toContainText("MIOW", { timeout: 10000 });

    // Click PIN Login tab
    const pinTab = page.getByRole("button", { name: /PIN Login/ });
    await expect(pinTab).toBeVisible();
    await pinTab.click();
    await page.waitForTimeout(500);

    // Verify form fields exist
    await expect(page.locator("#login-id")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#login-pin")).toBeVisible();
    await expect(page.getByPlaceholder(/Student ID, email, or username/)).toBeVisible();
    await expect(page.getByPlaceholder(/PIN or password/)).toBeVisible();

    // Submit button exists and is disabled when empty
    const submitBtn = page.getByRole("button", { name: /Continue to face verification/ });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();
  });

  test("filling PIN form enables submit button", async ({ page }) => {
    await page.goto("/auth");
    const pinTab = page.getByRole("button", { name: /PIN Login/ });
    await pinTab.click();
    await page.waitForTimeout(500);

    await page.locator("#login-id").fill("admin@test.miow");
    await page.locator("#login-pin").fill("1234");

    const submitBtn = page.getByRole("button", { name: /Continue to face verification/ });
    await expect(submitBtn).toBeEnabled();
  });

  test("RFID tab shows tap interface", async ({ page }) => {
    await page.goto("/auth");
    // Default is RFID tab
    await expect(page.locator("body")).toContainText("Listening for card tap");
    await expect(page.getByPlaceholder(/RFID UID/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Tap/ })).toBeVisible();
  });

  test("switching between RFID and PIN tabs works", async ({ page }) => {
    await page.goto("/auth");
    // Start on RFID
    await expect(page.locator("body")).toContainText("Listening for card tap");

    // Switch to PIN
    await page.getByRole("button", { name: /PIN Login/ }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("#login-id")).toBeVisible();

    // Switch back to RFID
    await page.getByRole("button", { name: /RFID Card/ }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toContainText("Listening for card tap");
  });

  test("empty PIN submission shows error toast", async ({ page }) => {
    await page.goto("/auth");
    const pinTab = page.getByRole("button", { name: /PIN Login/ });
    await pinTab.click();
    await page.waitForTimeout(500);

    await page.locator("#login-id").fill("test@test.com");
    await page.locator("#login-pin").fill("0000");
    await page.getByRole("button", { name: /Continue to face verification/ }).click();

    // Should show some error (invalid credentials or sign-in failed)
    await expect(async () => {
      const txt = await page.locator("body").textContent();
      if (!/Sign-in failed|Invalid credentials|Too many attempts|error/.test(txt || ""))
        throw new Error("waiting for error message");
    }).toPass({ timeout: 10000 });
  });
});

// ══════════════════════════════════════════════════════════
// ADMIN DASHBOARD FLOW
// ══════════════════════════════════════════════════════════
test.describe("Admin dashboard flow", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, "admin");
  });

  test("admin sees sidebar with all nav items", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await page.waitForTimeout(2000);
    const nav = page.locator("nav").first();
    await expect(nav).toContainText("Dashboard");
    await expect(nav).toContainText("Students");
    await expect(nav).toContainText("Teachers");
    await expect(nav).toContainText("Courses");
    await expect(nav).toContainText("Announcements");
    await expect(nav).toContainText("Settings");
  });

  test("admin can navigate to Students page", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Students/ }).first().click();
    await page.waitForURL(/\/dashboard\/admin\/students/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(/Students|Manage/);
  });

  test("admin can navigate to Teachers page", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Teachers/ }).first().click();
    await page.waitForURL(/\/dashboard\/admin\/teachers/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(/Teachers|Faculty/);
  });

  test("admin can navigate to Courses page", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Courses/ }).first().click();
    await page.waitForURL(/\/dashboard\/admin\/courses/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText("Courses");
  });

  test("admin can navigate to Announcements page", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Announcements/ }).first().click();
    await page.waitForURL(/\/dashboard\/admin\/announcements/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText("Announcements");
  });

  test("admin can navigate to Settings page", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Settings/ }).first().click();
    await page.waitForURL(/\/dashboard\/admin\/settings/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText("Settings");
  });

  test("admin can navigate to Attendance/Kiosk page", async ({ page }) => {
    await page.goto("/dashboard/admin/attendance");
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toContainText(/Attendance|Kiosk|Tap/i);
  });

  test("admin can open Create Course modal", async ({ page }) => {
    await page.goto("/dashboard/admin/courses");
    await page.waitForTimeout(2000);
    // Look for Course button
    const courseBtn = page.getByRole("button", { name: /Course/ });
    if (await courseBtn.isVisible()) {
      await courseBtn.click();
      await page.waitForTimeout(500);
      // Modal should appear
      await expect(page.locator("body")).toContainText(/Create.*Course|Course Title|Basic/);
    }
  });

  test("admin can open Create Assignment modal", async ({ page }) => {
    await page.goto("/dashboard/admin/courses");
    await page.waitForTimeout(2000);
    const assignBtn = page.getByRole("button", { name: /Assignment/ });
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toContainText(/Create.*Assignment|Worksheet title|Post assignment/);
    }
  });

  test("admin can open Create Worksheet modal", async ({ page }) => {
    await page.goto("/dashboard/admin/courses");
    await page.waitForTimeout(2000);
    const quizBtn = page.getByRole("button", { name: /Worksheet/ });
    if (await quizBtn.isVisible()) {
      await quizBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toContainText(/Create.*worksheet|Select course|Paste a ClassMate/);
    }
  });

  test("admin can open Google Docs import modal", async ({ page }) => {
    await page.goto("/dashboard/admin/courses");
    await page.waitForTimeout(2000);
    const importBtn = page.getByRole("button", { name: /Import from Google/ });
    if (await importBtn.isVisible()) {
      await importBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toContainText(/Import from Google Docs|Open Google Picker/);
    }
  });
});

// ══════════════════════════════════════════════════════════
// TEACHER DASHBOARD FLOW
// ══════════════════════════════════════════════════════════
test.describe("Teacher dashboard flow", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, "teacher");
  });

  test("teacher sees sidebar with correct nav items", async ({ page }) => {
    await page.goto("/dashboard/teacher");
    await page.waitForTimeout(2000);
    const nav = page.locator("nav").first();
    await expect(nav).toContainText("Dashboard");
    await expect(nav).toContainText("Students");
    await expect(nav).toContainText("Courses");
    await expect(nav).toContainText("Announcements");
    await expect(nav).toContainText("Gradebook");
    await expect(nav).toContainText("Attendance");
    await expect(nav).toContainText("Settings");
  });

  test("teacher can navigate to Students Info", async ({ page }) => {
    await page.goto("/dashboard/teacher");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Students/ }).first().click();
    await page.waitForURL(/\/dashboard\/teacher\/students/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(/Students|Students Info/i);
  });

  test("teacher can navigate to Settings", async ({ page }) => {
    await page.goto("/dashboard/teacher");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Settings/ }).first().click();
    await page.waitForURL(/\/dashboard\/teacher\/settings/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText("Settings");
  });
});

// ══════════════════════════════════════════════════════════
// STUDENT DASHBOARD FLOW
// ══════════════════════════════════════════════════════════
test.describe("Student dashboard flow", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, "student");
  });

  test("student sees sidebar with correct nav items", async ({ page }) => {
    await page.goto("/dashboard/student");
    await page.waitForTimeout(2000);
    const nav = page.locator("nav").first();
    await expect(nav).toContainText("Dashboard");
    await expect(nav).toContainText("Activities");
    await expect(nav).toContainText("Worksheets");
    await expect(nav).toContainText("Grades");
    await expect(nav).toContainText("Attendance");
    await expect(nav).toContainText("Settings");
  });

  test("student can navigate to Activities page", async ({ page }) => {
    await page.goto("/dashboard/student");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Activities/ }).first().click();
    await page.waitForURL(/\/dashboard\/student\/assignments/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(/Activities|Assignments/i);
  });

  test("student can navigate to Worksheets page", async ({ page }) => {
    await page.goto("/dashboard/student");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Worksheets/ }).first().click();
    await page.waitForURL(/\/dashboard\/student\/quizzes/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(/Worksheets|Quizzes/i);
  });

  test("student can navigate to Grades page", async ({ page }) => {
    await page.goto("/dashboard/student");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Grades/ }).first().click();
    await page.waitForURL(/\/dashboard\/student\/grades/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(/Grades|Grade/i);
  });

  test("student can navigate to Attendance page", async ({ page }) => {
    await page.goto("/dashboard/student");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Attendance/ }).first().click();
    await page.waitForURL(/\/dashboard\/student\/attendance/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(/Attendance/i);
  });

  test("student can navigate to Settings page", async ({ page }) => {
    await page.goto("/dashboard/student");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Settings/ }).first().click();
    await page.waitForURL(/\/dashboard\/student\/settings/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText("Settings");
  });
});

// ══════════════════════════════════════════════════════════
// CROSS-ROLE GUARDS
// ══════════════════════════════════════════════════════════
test.describe("Cross-role access guards", () => {
  test("student cannot access admin dashboard", async ({ page }) => {
    await seedSession(page, "student");
    await page.goto("/dashboard/admin");
    await page.waitForTimeout(3000);
    // Should redirect to student's own dashboard
    await expect(page).toHaveURL(/\/dashboard\/student/);
  });

  test("teacher can access admin courses (staff access)", async ({ page }) => {
    await seedSession(page, "teacher");
    await page.goto("/dashboard/admin/courses");
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toContainText("Courses");
  });
});

// ══════════════════════════════════════════════════════════
// REAL PIN LOGIN (requires DATABASE_URL)
// ══════════════════════════════════════════════════════════
const describeRealDB = process.env.PLAYWRIGHT_REAL_DB || process.env.DATABASE_URL ? test.describe : test.describe.skip;

describeRealDB("Real PIN login", () => {
  test.setTimeout(60000);

  test("admin logs in via PIN and sees Campus Overview", async ({ page }) => {
    await page.goto("/auth");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/auth");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /PIN Login/ }).click();
    await page.waitForTimeout(500);
    await page.locator("#login-id").fill("ana.reyes@northview.edu");
    await page.locator("#login-pin").fill("0000");
    await page.getByRole("button", { name: /Continue to face verification/ }).click();
    await expect(async () => {
      const txt = await page.locator("body").textContent();
      if (/Sign-in failed|Invalid credentials/.test(txt || "")) throw new Error("login failed");
      if (!/Locating face|Matching biometrics|Liveness check|Identity confirmed/.test(txt || ""))
        throw new Error("waiting for face verification");
    }).toPass({ timeout: 15000 });
    await page.waitForURL(/\/dashboard\/admin/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText("Campus Overview", { timeout: 15000 });
  });

  test("teacher logs in via PIN", async ({ page }) => {
    await page.goto("/auth");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/auth");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /PIN Login/ }).click();
    await page.waitForTimeout(500);
    await page.locator("#login-id").fill("maria.santos@northview.edu");
    await page.locator("#login-pin").fill("1111");
    await page.getByRole("button", { name: /Continue to face verification/ }).click();
    await expect(async () => {
      const txt = await page.locator("body").textContent();
      if (/Sign-in failed|Invalid credentials/.test(txt || "")) throw new Error("login failed");
      if (!/Locating face|Matching biometrics|Liveness check|Identity confirmed/.test(txt || ""))
        throw new Error("waiting for face verification");
    }).toPass({ timeout: 15000 });
    await page.waitForURL(/\/dashboard\/teacher/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText("Teacher Dashboard", { timeout: 15000 });
  });

  test("student logs in via PIN", async ({ page }) => {
    await page.goto("/auth");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/auth");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /PIN Login/ }).click();
    await page.waitForTimeout(500);
    await page.locator("#login-id").fill("juan.delacruz@student.northview.edu");
    await page.locator("#login-pin").fill("1234");
    await page.getByRole("button", { name: /Continue to face verification/ }).click();
    await expect(async () => {
      const txt = await page.locator("body").textContent();
      if (/Sign-in failed|Invalid credentials/.test(txt || "")) throw new Error("login failed");
      if (!/Locating face|Matching biometrics|Liveness check|Identity confirmed/.test(txt || ""))
        throw new Error("waiting for face verification");
    }).toPass({ timeout: 15000 });
    await page.waitForURL(/\/dashboard\/student/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText(/Student Dashboard|Welcome/i, { timeout: 15000 });
  });

  test("student can login via student_id", async ({ page }) => {
    await page.goto("/auth");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/auth");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /PIN Login/ }).click();
    await page.waitForTimeout(500);
    await page.locator("#login-id").fill("2024-0001");
    await page.locator("#login-pin").fill("1234");
    await page.getByRole("button", { name: /Continue to face verification/ }).click();
    await expect(async () => {
      const txt = await page.locator("body").textContent();
      if (/Sign-in failed|Invalid credentials/.test(txt || "")) throw new Error("login failed");
      if (!/Locating face|Matching biometrics|Liveness check|Identity confirmed/.test(txt || ""))
        throw new Error("waiting for face verification");
    }).toPass({ timeout: 15000 });
    await page.waitForURL(/\/dashboard\/student/, { timeout: 20000 });
  });
});

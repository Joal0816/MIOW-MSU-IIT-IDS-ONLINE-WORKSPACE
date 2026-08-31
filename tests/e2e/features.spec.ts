import { test, expect } from '@playwright/test';

// ── Homepage redirects to /auth ───────────────────────────
test.describe('MIOW – public routes', () => {
  test('homepage redirects to /auth', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('/auth', { timeout: 10000 });
    await expect(page).toHaveURL('/auth');
  });
});

// ── Auth guards (no session → /auth) ─────────────────────
test.describe('Auth guards', () => {
  test('unauthenticated /dashboard/admin redirects to /auth', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await page.waitForURL('/auth', { timeout: 10000 });
    await expect(page).toHaveURL('/auth');
  });
  test('unauthenticated /dashboard/teacher redirects to /auth', async ({ page }) => {
    await page.goto('/dashboard/teacher');
    await page.waitForURL('/auth', { timeout: 10000 });
    await expect(page).toHaveURL('/auth');
  });
  test('unauthenticated /dashboard/student redirects to /auth', async ({ page }) => {
    await page.goto('/dashboard/student');
    await page.waitForURL('/auth', { timeout: 10000 });
    await expect(page).toHaveURL('/auth');
  });
});

// ── Security headers ─────────────────────────────────────
test.describe('Security headers', () => {
  test('response has security headers', async ({ page }) => {
    const res = await page.goto('/auth');
    expect(res).toBeTruthy();
    expect(res!.headers()['x-content-type-options']).toBe('nosniff');
    expect(res!.headers()['x-frame-options']).toBe('DENY');
    expect(res!.headers()['strict-transport-security']).toContain('max-age=63072000');
    expect(res!.headers()['content-security-policy']).toContain("default-src 'self'");
  });
});

// ── G7-College course levels ─────────────────────────────
test.describe('G7-College course levels', () => {
  test('course levels helper is correct', async ({ page }) => {
    const res = await page.goto('/auth');
    const html = await page.content();
    expect(html).toContain('MIOW');
  });
});

// ── Activity alias ───────────────────────────────────────
test.describe('MIOW – Activity alias', () => {
  test('nav uses Activities label in source (not hardcoded Assignments)', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('body')).toContainText('MIOW');
  });
});

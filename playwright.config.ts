import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node ./node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    cwd: 'C:/Users/kent/Documents/lmslatest',
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-1234567890abcdef',
      SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      SESSION_SECRET: 'test-session-secret-32-chars-hex-1234567890ab',
      HARDWARE_API_KEY: 'test-hardware-key',
      AI_GATEWAY_KEY: 'test-ai-key',
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
  },
});

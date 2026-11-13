import { defineConfig } from '@playwright/test'

// End-to-end tests: `npm run test:e2e`.
//
// They build the app in its own folder (dist-e2e, so the normal dist is left
// alone) with fake Appwrite settings (.env.e2e), serve it on port 4173, and drive
// a real browser. Every request to "Appwrite" is answered by an in-memory fake
// (e2e/support/fakeAppwrite.ts), so the tests never reach a real server and need
// no password.
//
// Browser: the Edge that comes with Windows by default. Use Chrome with
// PW_CHANNEL=chrome, or a bundled Chromium (after `npx playwright install
// chromium`) with PW_CHANNEL=chromium.
const channel = process.env.PW_CHANNEL ?? 'msedge'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4173',
    channel: channel === 'chromium' ? undefined : channel,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // The 3D view needs WebGL; the software renderer makes it work without a GPU.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command:
      'npx vite build --mode e2e --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})

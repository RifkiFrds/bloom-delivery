import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end harness — Doc 05 §12.
 *
 * Two projects, because reduced motion is a REQUIREMENT rather than a variant:
 * Doc 04 §C.5 says content is never removed, only motion, and the only way to
 * know that holds is to run the whole suite with it on.
 *
 * `--use-file-for-fake-video-capture` can drive the detection stages from a
 * recorded clip once the Phase 0 fixture clips exist; the fake device is used
 * until then, which exercises the permission path but produces no faces.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI !== undefined ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
    {
      name: 'chromium-reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        // `reducedMotion` is a browser-context option, not a top-level `use`
        // key, in Playwright 1.62.
        contextOptions: { reducedMotion: 'reduce' },
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

const previewPort = 4173;
const previewHost = "127.0.0.1";
const previewOrigin = `http://${previewHost}:${previewPort}`;

/** GitHub Actions sets CI; workflow runs `npm run build` before e2e so we only start preview here (faster, avoids webServer timeout during long builds). */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  /** Per-test limit (CI runners and guest flow with IndexedDB reload can be slow). */
  timeout: 120_000,
  expect: {
    /** Match heading visibility waits in specs; avoids default 5s flaking on CI. */
    timeout: 20_000,
  },
  use: {
    baseURL: previewOrigin,
    trace: "on-first-retry",
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: isCI
      ? `npx vite preview --host ${previewHost} --port ${previewPort}`
      : `npm run build && npx vite preview --host ${previewHost} --port ${previewPort}`,
    url: previewOrigin,
    reuseExistingServer: !process.env.CI,
    /** Preview-only on CI is quick; local path still runs full build here. */
    timeout: isCI ? 120_000 : 180_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

import { getProdFrontendOrigin } from "./e2e/deployed/env";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e/deployed",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? "github" : "list",
  timeout: 120_000,
  expect: {
    timeout: 25_000,
  },
  use: {
    baseURL: getProdFrontendOrigin(),
    trace: "on-first-retry",
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

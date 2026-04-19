import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

import { getProdFrontendOrigin } from "./e2e/deployed/env";

// Load repo-root `.env` / `.env.local` so `npm run test:deployed` picks up PROD_* and E2E_* without exporting in the shell.
loadEnv();
loadEnv({ path: ".env.local", override: true });

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

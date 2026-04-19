# Testing

Requires **Node.js 20+** and dependencies (`npm run setup:dev` at the repo root, or `npm install` plus `npm --prefix backend install`).

## Layers

| Layer | What it covers | Location |
|-------|----------------|----------|
| **Unit** | Pure logic; no real HTTP server (frontend utilities; backend services, sanitizers, encryption) | `src/test/unit/`, `backend/test/unit/` |
| **Integration** | Frontend: React Testing Library + jsdom. Backend: Supertest + in-process Fastify + in-memory fakes | `src/test/integration/`, `backend/test/integration/` |
| **End-to-end** | Playwright against a production build (`vite preview`); guest-mode smoke | `e2e/` |

## Commands (local)

- Full gate (font catalog check + frontend + backend Vitest): `npm test` / `npm run test:all`
- Frontend Vitest: `npm run test:frontend` (or `test:frontend:unit` / `test:frontend:integration`)
- Frontend coverage: `npm run test:frontend:coverage` → `coverage/frontend/`
- Backend Vitest: `npm run test:backend` (or `npm --prefix backend run test:unit` / `test:integration`)
- Backend coverage: `npm run test:backend:coverage` → `coverage/backend/`
- Infrastructure checks: `npm --prefix infrastructure run typecheck && npm --prefix infrastructure run lint && npm --prefix infrastructure run test && npm --prefix infrastructure run synth`
- E2E: `npm run test:e2e` (first time: `npm run test:e2e:install` for Chromium)
- **Deployed integration:** `npm run test:deployed` — Playwright against the live Amplify app and API (`playwright.deployed.config.ts`, specs in `e2e/deployed/`). Specification: [docs/specs/test/deployed-integration.test-spec.md](specs/test/deployed-integration.test-spec.md).

`test:frontend` / `test:backend` alone do not run `check:font-catalogs`; use `npm test` for the full gate.

### Deployed integration environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `PROD_API_BASE_URL` | For API probe tests | API Gateway base URL (trailing slash optional; normalized in tests). Example: `https://….execute-api.….amazonaws.com/prod`. |
| `PROD_FRONTEND_URL` | Optional | Amplify origin; defaults to `https://main.d1on78tbp65odj.amplifyapp.com`. Use the **same** host you open in a browser (otherwise Playwright exercises a different build or API than your manual test). |
| `E2E_PROD_EMAIL` | For authenticated flows | Dedicated Cognito test user email (login form). |
| `E2E_PROD_PASSWORD` | For authenticated flows | Password for that user. |

If `E2E_PROD_EMAIL` / `E2E_PROD_PASSWORD` are unset, the authenticated serial suite is **skipped** so local runs can still execute health + SPA smoke tests. CI should define all variables and secrets so the full suite runs.

GitHub Actions: set `PROD_API_BASE_URL` and `PROD_FRONTEND_URL` as repository **variables** and the E2E credentials as **secrets** (see [.github/workflows/deployed-integration-tests.yml](../.github/workflows/deployed-integration-tests.yml)).

## Using coverage (signal, not a score)

Run `npm run test:frontend:coverage` and `npm run test:backend:coverage`, then open the HTML reports under `coverage/frontend/lcov-report/index.html` and `coverage/backend/lcov-report/index.html` (or read `coverage-summary.json` for a quick pass/fail view). Use reports to find **hotspots and branches** in risky areas (auth, persistence, API clients), not to chase 100% on thin UI code. Watch for **drops** in critical modules after refactors; raw percentages alone are misleading.

## What we do not fake in unit tests

**PostgreSQL** (`pg-document-repository`, `db.ts`) and **Redis** session stores need real databases or tools like Testcontainers to test truthfully. This repo defers those until a dedicated infra-testing initiative; shallow SQL mocks in Vitest are easy to get wrong and can give false confidence.

## Continuous integration

On push and pull requests to **`main`** or **`develop`**, the **[Tests](../.github/workflows/tests.yml)** workflow is the single entry point. It runs a **`changes`** job ([`dorny/paths-filter`](https://github.com/dorny/paths-filter)), then calls reusable workflows:

| Called workflow | Role |
|-----------------|------|
| [check-font-catalogs.yml](../.github/workflows/check-font-catalogs.yml) | Always; ensures `language-fonts.ts` and `document-fonts.ts` list the same `family` names (no `npm ci` required). |
| [run-frontend-tests.yml](../.github/workflows/run-frontend-tests.yml) | Vitest with coverage and Playwright E2E — only when frontend-related paths change (`src/`, `e2e/`, root `package.json`, Vite/Playwright config, `tests.yml`, or `run-frontend-tests.yml`). |
| [run-backend-tests.yml](../.github/workflows/run-backend-tests.yml) | `typecheck` and Vitest with coverage — only when `backend/` or orchestration files under the backend filter change. |
| [run-infrastructure-tests.yml](../.github/workflows/run-infrastructure-tests.yml) | Infrastructure typecheck, lint, CDK assertion tests, and `cdk synth` — only when `infrastructure/` or infra workflow files change. |

Those YAML files use **`workflow_call`** so the **Tests** run can invoke them; they also expose **`workflow_dispatch`** so you can run each workflow alone from the Actions tab when debugging.

PRs that only touch unrelated paths skip frontend/backend calls while still running the font catalog check.

On **push** and **pull_request**, [.github/workflows/deployed-integration-tests.yml](../.github/workflows/deployed-integration-tests.yml) runs the deployed Playwright suite against production URLs. Pull requests from repository forks skip this workflow by default (secrets are unavailable on fork workflows).

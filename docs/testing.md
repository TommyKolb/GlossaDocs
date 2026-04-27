# Testing

Requires **Node.js 20+** and dependencies (`npm run setup:dev` at the repo root, or `npm install` plus `npm --prefix backend install`).

## Layers

| Layer | What it covers | Location |
|-------|----------------|----------|
| **Unit** | Pure logic; no real HTTP server (frontend utilities; backend services, sanitizers, encryption) | `src/test/unit/`, `backend/test/unit/` |
| **Integration** | Frontend: React Testing Library + jsdom. Backend: Supertest + in-process Fastify + in-memory fakes | `src/test/integration/`, `backend/test/integration/` |
| **End-to-end** | Playwright against a production build (`vite preview`); guest-mode smoke | `e2e/` |

## Commands (local)

- Full gate (font + language-code catalog checks + frontend + backend Vitest): `npm test` / `npm run test:all`
- Frontend Vitest: `npm run test:frontend` (or `test:frontend:unit` / `test:frontend:integration`)
- Frontend coverage: `npm run test:frontend:coverage` → `coverage/frontend/`
- Backend Vitest: `npm run test:backend` (or `npm --prefix backend run test:unit` / `test:integration`)
- Backend coverage: `npm run test:backend:coverage` → `coverage/backend/`
- Infrastructure checks: `npm --prefix infrastructure run typecheck && npm --prefix infrastructure run lint && npm --prefix infrastructure run test && npm --prefix infrastructure run synth`
- E2E: `npm run test:e2e` (first time: `npm run test:e2e:install` for Chromium)
- Chinese pinyin dictionary refresh: `npm run generate:chinese-pinyin` downloads CC-CEDICT and rewrites the committed generated dictionary. Run it only when refreshing that data or changing generation heuristics; normal tests and builds use the committed file.
- **Deployed integration:** `npm run test:deployed` — Playwright against the live Amplify app and API (`playwright.deployed.config.ts`, specs in `e2e/deployed/`). Specification: [docs/specs/test/deployed-integration.test-spec.md](specs/test/deployed-integration.test-spec.md).

`test:frontend` / `test:backend` alone do not run `check:font-catalogs` or `check:language-codes`; use `npm test` for the full gate.

Composition-style language changes, such as Chinese pinyin input, should include focused frontend coverage in `src/test/unit/chinese-pinyin.test.ts`, `src/test/integration/language-keyboard.test.tsx`, and `src/test/integration/editor-keyboard-mapping.test.tsx` in addition to language-code, font, and backend validation checks.

### Deployed integration environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `PROD_API_BASE_URL` | For API probe tests | API Gateway base URL (trailing slash optional; normalized in tests). Example: `https://….execute-api.….amazonaws.com/prod`. |
| `PROD_FRONTEND_URL` | Yes | Amplify origin. Use the **same** host you open in a browser (otherwise Playwright exercises a different build or API than your manual test). |
| `E2E_PROD_EMAIL` | For authenticated flows | Dedicated Cognito test user email (login form). |
| `E2E_PROD_PASSWORD` | For authenticated flows | Password for that user. |

If `E2E_PROD_EMAIL` / `E2E_PROD_PASSWORD` are unset, the authenticated serial suite is **skipped** so local runs can still execute health + SPA smoke tests. CI now validates required variables/secrets up front and fails fast when they are missing.

The authenticated Playwright file [`e2e/deployed/authenticated.integration.spec.ts`](../e2e/deployed/authenticated.integration.spec.ts) runs [`cleanupE2EAccountData`](../e2e/deployed/cleanup-e2e-account.ts) in `afterAll`: it ensures the browser is authenticated as the configured E2E user (re-authenticates when needed), then uses that browser context session to delete every document and folder and clear `keyboardLayoutOverrides` via the REST API so the E2E user does not accumulate data across runs. Set `PROD_API_BASE_URL` and E2E credentials so cleanup can reach and authenticate to the API.

GitHub Actions: set `PROD_API_BASE_URL` and `PROD_FRONTEND_URL` as repository **variables** and the E2E credentials as **secrets** (see [.github/workflows/deployed-integration-tests.yml](../.github/workflows/deployed-integration-tests.yml)).

**Persisting vars locally:** copy [`.env.example`](../.env.example) to **`.env`** (or **`.env.local`**) in the repo root and set `PROD_*` / `E2E_*` there. `playwright.deployed.config.ts` loads `.env` then `.env.local` (override) automatically for `npm run test:deployed`. Do **not** commit real secrets; `.env` is gitignored.

## Using coverage (signal, not a score)

Run `npm run test:frontend:coverage` and `npm run test:backend:coverage`, then open the HTML reports under `coverage/frontend/lcov-report/index.html` and `coverage/backend/lcov-report/index.html` (or read `coverage-summary.json` for a quick pass/fail view). Use reports to find **hotspots and branches** in risky areas (auth, persistence, API clients), not to chase 100% on thin UI code. Watch for **drops** in critical modules after refactors; raw percentages alone are misleading.

## What we do not fake in unit tests

**PostgreSQL** (`pg-document-repository`, `db.ts`) and **Redis** session stores need real databases or tools like Testcontainers to test truthfully. This repo defers those until a dedicated infra-testing initiative; shallow SQL mocks in Vitest are easy to get wrong and can give false confidence.

## Continuous integration

On push and pull requests to **`main`** or **`develop`**, the **[Tests](../.github/workflows/tests.yml)** workflow is the single entry point. It runs a **`changes`** job ([`dorny/paths-filter`](https://github.com/dorny/paths-filter)), then calls reusable workflows:

| Called workflow | Role |
|-----------------|------|
| [check-font-catalogs.yml](../.github/workflows/check-font-catalogs.yml) | Always; ensures `language-fonts.ts` and `document-fonts.ts` list the same `family` names (no `npm ci` required). |
| [run-frontend-tests.yml](../.github/workflows/run-frontend-tests.yml) | Vitest with coverage and Playwright E2E — when frontend-related paths change (`src/`, `e2e/`, root `package.json`, Vite/Playwright config, or `run-frontend-tests.yml`), or when [tests.yml](../.github/workflows/tests.yml) changes (orchestrates a full test matrix for that run). |
| [run-backend-tests.yml](../.github/workflows/run-backend-tests.yml) | `typecheck` and Vitest with coverage — when `backend/` or `run-backend-tests.yml` change, or when `tests.yml` changes. |
| [run-infrastructure-tests.yml](../.github/workflows/run-infrastructure-tests.yml) | Infrastructure typecheck, lint, CDK assertion tests, `cdk synth`, and on **pull requests** an optional `cdk diff` when repository variable `DEPLOY_AWS_ROLE_ARN` is set (same behavior as the old standalone infrastructure-diff workflow) — when `infrastructure/` or `run-infrastructure-tests.yml` change, or when `tests.yml` changes. |
| [infrastructure-diff.yml](../.github/workflows/infrastructure-diff.yml) (optional) | **Manual** “Run workflow” only — for ad-hoc CDK diff. PR coverage lives in the Tests workflow. |

Those YAML files use **`workflow_call`** so the **Tests** run can invoke them; they also expose **`workflow_dispatch`** so you can run each workflow alone from the Actions tab when debugging.

PRs that only touch unrelated paths skip frontend/backend calls while still running the font catalog check.

On push and pull requests to **`main`** or **`develop`**, [.github/workflows/deployed-integration-tests.yml](../.github/workflows/deployed-integration-tests.yml) runs the deployed Playwright suite against production URLs. The job uses the **Production** GitHub Environment for variables and secrets but sets `deployment: false` so a **deployment object** is not created (per [using an environment without creating a deployment](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#example-using-an-environment-without-creating-a-deployment); not compatible with custom deployment protection rules on that environment). You can instead use repository- or org-level `PROD_*` and E2E values if you prefer. Pull requests from repository forks skip this workflow by default (secrets are unavailable on fork workflows). The workflow also serializes runs with a dedicated `concurrency` group to reduce collisions on the shared E2E account.

## Related

- [Local development](development/local-development.md) — Docker, guest mode, ports.
- [AWS deployment runbook](deployment/aws-amplify-apigw-lambda-auth-runbook.md) — production Amplify, API Gateway, Lambda, Cognito, RDS, Redis.

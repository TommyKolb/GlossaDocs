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
- E2E: `npm run test:e2e` (first time: `npm run test:e2e:install` for Chromium)

`test:frontend` / `test:backend` alone do not run `check:font-catalogs`; use `npm test` for the full gate.

## Using coverage (signal, not a score)

Run `npm run test:frontend:coverage` and `npm run test:backend:coverage`, then open the HTML reports under `coverage/frontend/lcov-report/index.html` and `coverage/backend/lcov-report/index.html` (or read `coverage-summary.json` for a quick pass/fail view). Use reports to find **hotspots and branches** in risky areas (auth, persistence, API clients), not to chase 100% on thin UI code. Watch for **drops** in critical modules after refactors; raw percentages alone are misleading.

## What we do not fake in unit tests

**PostgreSQL** (`pg-document-repository`, `db.ts`) and **Redis** session stores need real databases or tools like Testcontainers to test truthfully. This repo defers those until a dedicated infra-testing initiative; shallow SQL mocks in Vitest are easy to get wrong and can give false confidence.

## Continuous integration

On push and pull requests to **`main`** or **`develop`**:

- [`.github/workflows/check-font-catalogs.yml`](../.github/workflows/check-font-catalogs.yml) — always runs; ensures `language-fonts.ts` and `document-fonts.ts` list the same `family` names (no `npm ci` required).
- [`.github/workflows/run-frontend-tests.yml`](../.github/workflows/run-frontend-tests.yml) — Vitest with coverage, Playwright E2E (path-filtered).
- [`.github/workflows/run-backend-tests.yml`](../.github/workflows/run-backend-tests.yml) — `typecheck`, Vitest with coverage (path-filtered when `backend/` changes).

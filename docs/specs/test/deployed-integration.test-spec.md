# Deployed integration test specification

This specification describes **end-to-end integration tests** that exercise **both** the GlossaDocs SPA (AWS Amplify) and the REST API (API Gateway → Lambda) in production-like configuration. Tests are implemented with Playwright under `e2e/deployed/` and run via `npm run test:deployed`.

## Scope

- **In scope:** HTTP probes against the deployed API (`/health`, `/ready`), loading the SPA from the deployed frontend origin, Cognito-backed login and session cookies (`/auth/login`, `/auth/session`, `/auth/logout`), and authenticated CRUD flows that call `/documents`, `/folders`, and `/settings` through the UI.
- **Configuration:** `PROD_API_BASE_URL` (API Gateway base, no trailing slash required in env), `PROD_FRONTEND_URL` (Amplify origin; optional if default is acceptable), and secrets `E2E_PROD_EMAIL` / `E2E_PROD_PASSWORD` for a dedicated test user.
- **Out of scope (future / manual):** Hosted OIDC redirect-only flows (`/auth/public`), email-based password reset, creating a brand-new Cognito user on every CI run, and guest-mode document storage (local IndexedDB only; no backend document API).

## Functionality that must be tested

1. **API availability** — Lambda serves lightweight health and deeper readiness (Postgres + session store).
2. **Static hosting** — Amplify serves the SPA; the sign-in shell renders.
3. **Authentication** — Login establishes a session; reload restores the session via `/auth/session`; logout clears the server session and returns to sign-in.
4. **Documents (authenticated)** — List, create, open editor, save to server, verify persistence after full reload, delete.
5. **Folders (authenticated)** — Create a folder from the document list UI and verify it appears (depends on list API and create folder API).
6. **User settings (authenticated)** — Editor loads settings from the server; saving keyboard mapping overrides issues a settings update and survives reload; test cleans up by resetting mappings.

## Test table

Each row maps **1:1** to a Playwright test in `e2e/deployed/`.

| ID | Purpose | Inputs | Expected result (pass) |
|----|---------|--------|-------------------------|
| D-API-01 | Verify deployed API process responds | `GET {PROD_API_BASE_URL}/health` | HTTP 200; JSON includes `status: "ok"`. |
| D-API-02 | Verify API dependencies used in production | `GET {PROD_API_BASE_URL}/ready` | HTTP 200; JSON `status` is `"ready"` and dependency checks are successful. |
| D-FE-01 | Verify Amplify serves the app shell | Navigate to `{PROD_FRONTEND_URL}/` (Playwright `baseURL`). | “Sign in to continue” heading (or equivalent login shell) is visible; no blank error page. |
| D-AUTH-01 | Verify credentials login hits API and reaches authenticated UI | Valid `E2E_PROD_EMAIL`, `E2E_PROD_PASSWORD`; submit login form (`Email`, `Password`, Sign in). | “Welcome to GlossaDocs” heading visible; “Signed in as” shows the test account. |
| D-AUTH-02 | Verify session cookie + `/auth/session` after cold reload | Same as D-AUTH-01, then full page reload (`page.reload()`). | User remains authenticated (welcome / signed-in copy still visible; not returned to login card). |
| D-AUTH-03 | Verify authenticated document list load (no server error banner) | Logged-in session. | No “Failed to load documents” alert; either empty state or “Your Documents” list region is shown. |
| D-DOC-01 | Verify document creation persists on server | Logged-in; click “Create New Document” (primary). | Editor loads; `Document editor for …` contenteditable region visible. |
| D-DOC-02 | Verify explicit save triggers successful write | Open editor; set unique title; type body text; `Control+S`. | “All changes are saved” (or saved indicator) becomes visible within timeout. |
| D-DOC-03 | Verify document content survives full reload | After D-DOC-02, reload page, open same document by title from list. | Editor shows previously typed body text. |
| D-DOC-04 | Verify delete removes document on server | From list, delete the document created for D-DOC-* (confirm dialog). | Document card for that title is gone after deletion completes. |
| D-FLD-01 | Verify folder creation | Logged-in user with at least one document so list chrome is visible; “New Folder”; unique folder name; “Create”. | Folder appears with `Open folder {name}` control. |
| D-SET-01 | Verify settings persistence via keyboard mapping | In editor, open “Customize English keyboard mappings”; set physical key for `q` to `9`; Save mappings; reload; reopen editor and dialog. | On-screen key shows insert-q-using-9 after save; after reload + reopen, mapping still present; then **Reset English** + Save mappings to restore defaults. |

## References

- API client and routes: [`src/app/api/client.ts`](../../../src/app/api/client.ts), [`src/app/api/endpoints.ts`](../../../src/app/api/endpoints.ts)
- Deploy runbook: [`docs/deployment/aws-amplify-apigw-lambda-auth-runbook.md`](../../deployment/aws-amplify-apigw-lambda-auth-runbook.md)
- Local testing overview: [`docs/testing.md`](../../testing.md)

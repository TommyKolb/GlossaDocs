# GlossaDocs

GlossaDocs is a browser-based document editor inspired by Google Docs, with a product focus on better multilingual writing workflows.

The current codebase is a working local-first UI prototype with rich text editing, document storage in the browser, and language-aware UX foundations.

## What The Project Is

GlossaDocs aims to make multilingual writing feel native instead of bolted on. The core concept is:

- Let users choose language intent per document.
- Build toward integrated non-Latin input methods (starting with Russian in planned stories).
- Preserve a familiar docs-style experience (document list, editor, autosave, export/import).

## Current Implementation (In This Repo)

- Rich text editor built on `contentEditable` with formatting controls:
  - Bold, italic, underline
  - Font size, alignment, and line spacing
  - Image insertion (PNG/JPEG, with size cycling)
- Document management UI:
  - Create new document
  - Open existing document
  - Delete document
  - Edit document title
- Persistence:
  - Browser IndexedDB storage (`GlossaDocs` database)
  - Auto-save after 10 seconds of unsaved changes
  - Manual save button and saved/unsaved status indicators
- Import/Export:
  - Import `.txt` and `.docx`
  - Export `.txt`, `.docx`, and `.pdf`
- Language support (current UI):
  - Per-document language selector for `en`, `de`, `ru`
  - Direction handling scaffold exists for future RTL languages
- Auth state:
  - Login/guest flow is currently simulated with local storage placeholders (no real backend auth yet)


## Tech Stack

- React + TypeScript
- Vite
- IndexedDB for local document persistence
- UI libraries: MUI, Radix, Tailwind ecosystem utilities
- File conversion/export libraries:
  - `mammoth` for `.docx` import
  - `docx` and `jspdf` for export

## Running Locally

### Fastest full-stack startup (Docker Compose)

Run everything (frontend + backend + Postgres + Keycloak) with one command:

1. Install Docker Desktop
2. From repo root:
   - `npm run dev:docker`
3. Open:
   - Frontend: `http://localhost:5173`
   - Backend health: `http://localhost:4000/health`
   - Keycloak admin: `http://localhost:8080` (admin/admin)

Stop the stack:

- `npm run dev:docker:down`

Docker dev credentials for authenticated mode:

- Username: `devuser`
- Password: `devpass`
- Backend token verification is configured to accept Keycloak issuer `http://localhost:8080/realms/glossadocs` in Docker mode.

### Quick start without database (guest mode only)

If you want to run immediately with no backend services:

1. `npm install`
2. `npm run dev:guest`
3. Open `http://localhost:5173` and choose **Continue as Guest**

This mode is local-only (IndexedDB/localStorage) and does not require Postgres or Keycloak.

### Local non-Docker full-stack mode

Prerequisites:

- Node.js 20+
- PostgreSQL running locally
- Keycloak running locally

Setup:

1. `npm run setup:dev`
2. Copy `.env.example` to `.env`
3. Copy `backend/.env.example` to `backend/.env`
4. `npm run migrate:all`
5. `npm run dev:all`

## Frontend-Backend Integration (Current State)

The frontend now supports two runtime modes:

- **Guest mode (local-only):**
  - Documents are stored in IndexedDB.
  - User settings are stored in local storage.
  - No backend token is required.
- **Authenticated dev mode (backend-backed):**
  - Documents are loaded/saved through backend `/documents` endpoints.
  - Settings are loaded/saved through backend `/settings`.
  - User bootstrap uses backend `/me` when a token is present.

### API Base URL

Set the backend URL with:

- `VITE_API_BASE_URL=http://localhost:4000`

If `VITE_API_BASE_URL` is not set, the frontend defaults to `http://localhost:4000`.

### Dev Auth Placeholder (Temporary)

Authentication is still mocked for development:

- Frontend first tries to exchange credentials against local Keycloak (`devuser` / `devpass` in Docker setup).
- If no OIDC token exchange is available, a JWT string can be provided manually as the password for development.
- The access token is stored as `authToken` in local storage and sent as `Authorization: Bearer <token>`.

Practical implication:

- For Docker full-stack mode, use `devuser` / `devpass`.

### OIDC/Keycloak Replacement TODO (Planned)

When moving to real authentication (OIDC Auth Code + PKCE), replace the placeholder logic in:

- `src/app/utils/auth.ts`
  - `loginWithCredentials()` -> replace with real OIDC sign-in flow/token acquisition
  - `getAccessToken()` storage strategy -> replace with secure token/session handling
  - `logout()` -> call IdP end-session / revoke tokens as appropriate
  - `getAuthenticatedUserFromBackend()` -> add refresh/reauth behavior on auth failures
- `src/app/components/Login.tsx`
  - replace mocked login form submission with OIDC sign-in entrypoint

Keep guest mode available and local-only unless product requirements change.

### Adding New Languages

The app now centralizes language values in a small number of files:

- Backend canonical language list: `backend/src/shared/document-languages.ts`
- Frontend language list + UI metadata: `src/app/utils/languages.ts`

If you add a new language:

1. Update backend language list.
2. Add a DB migration that updates the `documents_language_check` constraint.
3. Update frontend language list/metadata.

The initial migration file `backend/migrations/001_create_documents.js` is intentionally historical/immutable.

### Audit Event Growth

`api_audit_events` is append-only, so growth is unbounded unless retention is applied.

For current local/dev usage this is acceptable. For longer-running environments, add one of:

- A scheduled cleanup job (for example: delete rows older than N days).
- Partitioning by time with periodic partition drop.
- Archival pipeline to move old audit rows to cheaper storage.

### Deploying to AWS Lambda

The backend can run on AWS Lambda behind API Gateway. Use the Lambda entrypoint:

- **Handler**: `dist/lambda.handler` (or `lambda.handler` if the deployment package root is `dist/`).
- Set Lambda environment variables (or use Secrets Manager for `DATABASE_URL`): `NODE_ENV`, `API_PORT`, `CORS_ALLOWED_ORIGINS`, `DATABASE_URL`, `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`.

Deploy the built backend (e.g. `dist/`, `migrations/`, `node_modules`) as the Lambda function code and point API Gateway HTTP API (or REST API) at this handler.

## Current Limitations

- Backend exists, but frontend authentication is still in temporary dev mode (not real OIDC login flow yet).
- No collaboration/sharing yet.
- Language features are in progress; current language selection is foundational, with advanced input-method behavior planned.
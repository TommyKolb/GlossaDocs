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
  - Dev email inbox (Mailpit): `http://localhost:8025`

Stop the stack:

- `npm run dev:docker:down`

Docker dev credentials for authenticated mode:

- Username: `devuser@example.com`
- Password: `devpass`
- In Docker mode, backend token verification uses the internal Keycloak issuer URL `http://keycloak:8080/realms/glossadocs`.

### Creating an account (email + password) and resetting passwords

This branch uses **Keycloak** for signup and password reset (the app does not store passwords).

- **Create account**: on the login screen, click **Create account** and register with your email + password.
- **Forgot password**: on the login screen, click **Forgot password?** and follow the email reset flow.
- **Dev email inbox**: reset emails are delivered to Mailpit at `http://localhost:8025`.

Privacy promise: **Your email will never be used for spam or shared with anyone else.**

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

### Authentication (App-Hosted UI + Keycloak + Cookie Session)

Authenticated mode uses **Keycloak** for identity, with app-hosted auth UI and backend-managed sessions:

- **Sign in**:
  - On the login screen, enter your email + password once.
  - The frontend calls backend `POST /auth/login`.
  - The backend exchanges credentials with Keycloak and sets an **httpOnly session cookie**.
  - The frontend bootstraps the user through `GET /auth/session`.
- **Create account**:
  - Uses the app-hosted **Create your account** screen, which calls `POST /auth/register` on the backend.
  - The backend creates the user in Keycloak; the app never stores or sees the raw password.
- **Forgot password**:
  - Uses the app-hosted **Reset your password** screen, which calls `POST /auth/password-reset`.
  - The backend asks Keycloak to send a reset email. The user sees a generic success message, regardless of whether the account exists, to avoid leaking account existence.

Security notes:

- Passwords are handled **only** by Keycloak; the app does not store them.
- Authenticated browser sessions are stored in backend-managed httpOnly cookies (no bearer token in frontend local storage).
- All user data persisted by the app continues to respect the existing encryption and sanitization rules documented below.

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

### Document encryption at rest

Document title and content can be encrypted in PostgreSQL so that anyone with DB access cannot read them without the key. Set `DOCUMENT_ENCRYPTION_KEY` (base64-encoded 32-byte key) in the backend environment. See [docs/architecture/document-encryption.md](docs/architecture/document-encryption.md) for design and key management.

When `DOCUMENT_ENCRYPTION_KEY` is set but invalid (not base64 of 32 bytes), the backend **fails fast at startup** with a configuration error. Treat this as a fatal misconfiguration and fix the key before deploying.

### HTML sanitization and editor formatting

The backend sanitizes document titles and content on write:

- Titles are stripped to plain text (no HTML tags or attributes are preserved).
- Content is sanitized with an allowlist of safe tags/attributes (paragraphs, spans with inline styles, basic text formatting, and images with safe attributes/schemes).

The frontend rich-text editor should only expose formatting that survives this sanitization pass. If you add new formatting options in the editor, update the backend sanitizer policy (and the corresponding tests) to keep the two in sync.

## Current Limitations

- Session storage is currently in-memory on the backend (suitable for local/dev; use shared session storage for multi-instance production).
- No collaboration/sharing yet.
- Language features are in progress; current language selection is foundational, with advanced input-method behavior planned.
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

- The login form's **password field is currently treated as a temporary bearer token**.
- That token is stored as `authToken` in local storage.
- Frontend requests send `Authorization: Bearer <authToken>` for authenticated mode.

Practical implication:

- To test backend-backed frontend flows, log in with any username and set the password to a token accepted by the backend/test setup.

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

## Current Limitations

- Backend exists, but frontend authentication is still in temporary dev mode (not real OIDC login flow yet).
- No collaboration/sharing yet.
- Language features are in progress; current language selection is foundational, with advanced input-method behavior planned.
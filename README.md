# GlossaDocs

GlossaDocs is a browser-based document editor inspired by Google Docs, aimed at **multilingual writing**: per-document language, on-screen keyboards and key remapping for non-Latin scripts (for example Russian), and a familiar flow—document list, rich-text editor, autosave, import/export.

**Why it exists:** many tools treat language as an afterthought. GlossaDocs is built so language choice and input methods sit next to editing, not in a separate toolchain.

**Privacy:** your email is used for sign-in and account recovery only. We do not sell it or use it for marketing. Passwords are handled by **Keycloak**, not stored in GlossaDocs application code.

## Architecture (high level)

- **Frontend:** React (Vite), rich text via `contentEditable`, local **guest** mode (IndexedDB) or **authenticated** mode talking to the API.
- **Backend:** single **Fastify** service (modular monolith)—JWT verification, cookie-backed sessions, REST for documents and user settings, HTML sanitization, optional encryption at rest in PostgreSQL.
- **Identity:** **Keycloak** (OIDC). The app does not store passwords; login, signup, and password reset go through Keycloak (and the Admin API where needed).

Deeper detail: [docs/architecture/backend-architecture.md](docs/architecture/backend-architecture.md) and [docs/architecture/system.md](docs/architecture/system.md). Backend operations (dependencies, data stores, runbooks): [backend/README.md](backend/README.md).

## Get started on a new machine

**What you need**

| Requirement | Purpose |
|-------------|---------|
| **Git** | Clone this repository. |
| **Docker** with Compose | **Docker Desktop** (Windows/macOS) or Docker Engine + the **Compose plugin** (Linux). The daemon must be running before you start. |
| **Node.js 20+ and npm** | Only if you use the `npm run dev:docker` shortcut. **Not** required if you invoke Docker Compose directly (see below). |

**Clone and run the full stack (Docker)**

1. Clone the repo and `cd` into it (folder name matches whatever you used in `git clone`):
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```
   **Environment files:** you do **not** need to create `.env` or `backend/.env` for this Docker workflow. `docker-compose.yml` sets the backend’s database, OIDC, and Keycloak variables directly, and the frontend image is built with `VITE_API_BASE_URL` as a build argument. For a **local** backend (`npm` on your machine, no Docker Compose for the API), copy `backend/.env.example` to `backend/.env` as described in [backend/README.md](backend/README.md#install) under **Install**.

2. Start the full stack: frontend, API, PostgreSQL, Keycloak, and Mailpit. On **first run**, images are built; **`npm install` on your laptop is not required**—Dockerfiles run `npm ci` inside the build. Use either:
   ```bash
   npm run dev:docker
   ```
   **Or** (same effect, no Node/npm needed on the host):
   ```bash
   docker compose up --build
   ```
3. **First boot** can take several minutes (builds, Postgres health, Keycloak realm import, backend migrations). When the stack is ready, open:
   - **App:** [http://localhost:5173](http://localhost:5173)
   - **API health:** [http://localhost:4000/health](http://localhost:4000/health)
   - **Keycloak admin console:** [http://localhost:8080](http://localhost:8080) — `admin` / `admin`
   - **Mailpit (dev inbox):** [http://localhost:8025](http://localhost:8025)

4. **Stop** the stack: `npm run dev:docker:down` or `docker compose down`.

5. **Ports** on your machine must be free: **5173** (app), **4000** (API), **5432** (Postgres), **8080** (Keycloak), **8025** (Mailpit UI), **1025** (Mailpit SMTP). Edit `docker-compose.yml` if you have conflicts.

**Windows:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) with WSL2 is typical; enable virtualization if the installer asks.

**Linux:** install the Docker Engine and [Compose plugin](https://docs.docker.com/compose/install/linux/); your user may need to be in the `docker` group.

### Docker dev login (pre-seeded user)

Use these to sign in in **authenticated** mode without registering:

- **Email:** `devuser@example.com`
- **Password:** `devpass`

The Docker backend is configured so token verification uses the **internal** Keycloak URL (`http://keycloak:8080/...`) while browsers use `localhost`. You can also use **Create account** on the login screen; outbound mail is optional in dev, and password-reset messages appear in Mailpit.

## Other ways to run

| Goal | Command / steps |
|------|-------------------|
| **Frontend only, no database** | **Node.js 20+** and `npm install` at repo root, then `npm run dev:guest` → [http://localhost:5173](http://localhost:5173) → **Continue as Guest** (IndexedDB + localStorage; no backend). |
| **Full stack without Docker** | Node 20+, local PostgreSQL and Keycloak, then `npm run setup:dev`, copy `.env` / `backend/.env` from `.env.example` files, `npm run migrate:all`, `npm run dev:all`. See [backend/README.md](backend/README.md). |

**API URL for the frontend:** set `VITE_API_BASE_URL` (defaults to `http://localhost:4000`).

## Tests

Requires **Node.js 20+** and dependencies: from the repo root run `npm run setup:dev` once (installs root + `backend/` packages), or run `npm install` and `npm --prefix backend install` yourself.

- Frontend: `npm run test:frontend` (Vitest, `src/test/`)
- Backend: `npm run test:backend` (Vitest, `backend/test/`)

## Further reading

- [Document encryption at rest](docs/architecture/document-encryption.md) (`DOCUMENT_ENCRYPTION_KEY`)
- Operational concerns (sessions, Postgres, Keycloak, reset procedures): **[backend/README.md](backend/README.md)**

# Local development

This guide is for **developers** who want to run GlossaDocs on their machine. End users only need a browser and the app URL your deployment provides.

**Pull requests:** open them against the **`develop`** branch so reviewers see a small, relevant diff. Set the base branch in GitHub when you open the PR.

## Choose a path

| Path | When to use |
|------|-------------|
| **Docker Compose (recommended)** | Full stack: app, API, PostgreSQL, Keycloak, Mailpit. No `npm install` on the host required. |
| **Guest-only frontend** | Quick UI work without a database: `npm run dev:guest` at the repo root. |
| **API on Node without Docker** | You run Postgres and Keycloak locally; see [backend/README.md](../../backend/README.md) (Install, Start and stop). |

Deployment to AWS is **not** covered here; use [AWS deployment runbook](../deployment/aws-amplify-apigw-lambda-auth-runbook.md) and [AWS fork bootstrap](../deployment/aws-fork-bootstrap.md).

## Docker Compose full stack

### Requirements

| Requirement | Purpose |
|-------------|---------|
| **Git** | Clone this repository. |
| **Docker** with Compose | **Docker Desktop** (Windows/macOS) or Docker Engine + **Compose plugin** (Linux). The daemon must be running. |
| **Node.js 20+ and npm** | Only if you use `npm run dev:docker`. **Not** required if you run `docker compose up --build` directly. |

### Clone and start

1. Clone and enter the repo (folder name is whatever you chose in `git clone`):

   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Environment files:** you do **not** need `.env` or `backend/.env` for this Docker workflow. `docker-compose.yml` sets the backend’s database, OIDC, and Keycloak variables; the frontend image is built with `VITE_API_BASE_URL` as a build argument. For running the **API on the host** without Compose, copy `backend/.env.example` to `backend/.env` per [backend/README.md](../../backend/README.md#install).

3. Start the stack (first run builds images; `npm ci` runs inside Docker, not necessarily on your laptop):

   ```bash
   npm run dev:docker
   ```

   Or, same effect without Node on the host:

   ```bash
   docker compose up --build
   ```

4. **First boot** can take several minutes (images, Postgres health, Keycloak realm import, migrations). When ready:

   - **App:** [http://localhost:5173](http://localhost:5173)
   - **API health:** [http://localhost:4000/health](http://localhost:4000/health)
   - **Keycloak admin:** [http://localhost:8080](http://localhost:8080) — `admin` / `admin`
   - **Mailpit (dev mail):** [http://localhost:8025](http://localhost:8025)

5. **Stop:** `npm run dev:docker:down` or `docker compose down`.

### Ports

These must be free on your machine unless you change `docker-compose.yml`:

| Port | Service |
|------|---------|
| 5173 | Frontend |
| 4000 | API |
| 5432 | PostgreSQL |
| 8080 | Keycloak |
| 8025 | Mailpit UI |
| 1025 | Mailpit SMTP |

**Windows:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) with WSL2 is typical.

**Linux:** [Docker Engine + Compose](https://docs.docker.com/compose/install/linux/); your user may need the `docker` group.

### Auth in Docker dev

- Use **Create account** for a local Keycloak-backed user, or **Continue as Guest** for browser-only storage.
- The backend verifies tokens against the **internal** Keycloak URL (`http://keycloak:8080/...`) while the browser uses `localhost`. Password-reset email in dev is visible in **Mailpit**.

### `APP_ENV` and providers

Backend behavior is driven mainly by `APP_ENV`:

- **`dev`** — Keycloak-friendly defaults (typical for Docker above).
- **`prod`** — Strict checks and Cognito-oriented configuration (production Lambda).

See [backend/.env.example](../../backend/.env.example) and the [AWS deployment runbook](../deployment/aws-amplify-apigw-lambda-auth-runbook.md) for production variables.

## Frontend-only (guest mode)

From the repo root, with **Node.js 20+**:

```bash
npm install
npm run dev:guest
```

Open [http://localhost:5173](http://localhost:5173) and choose **Continue as Guest**. Data stays in the browser (IndexedDB / localStorage); there is no backend.

The Chinese pinyin candidate dictionary is committed at `src/app/data/chinese-pinyin-dictionary.generated.ts`, so local development does not need to generate it. Run `npm run generate:chinese-pinyin` only when intentionally refreshing CC-CEDICT data or changing the generator, and keep `THIRD_PARTY_NOTICES.md` aligned with that data source.

## Full stack without Docker

Requires Node 20+, local PostgreSQL, Keycloak, and manual env setup:

1. `npm run setup:dev` at the repo root (or install root + `backend/` packages).
2. Copy `.env` / `backend/.env` from the `*.env.example` files.
3. `npm run migrate:all` then `npm run dev:all`.

Details: [backend/README.md](../../backend/README.md).

## Frontend API URL

When the app must talk to the API (authenticated mode or custom setup), set **`VITE_API_BASE_URL`** (defaults to `http://localhost:4000` for local builds).

## Related

- [Testing](../testing.md) — Vitest, Playwright, CI, deployed integration.
- [Backend README](../../backend/README.md) — migrations, health, resets, encryption notes.
- [Cognito email and SES](../deployment/cognito-email-and-ses.md) — quotas and optional SES.

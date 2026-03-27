# GlossaDocs backend

This directory is the **Node.js API** for GlossaDocs: a **Fastify** application that exposes REST endpoints for authentication (via **Keycloak**), documents, user settings, and operational audit logging. It is designed as a **modular monolith** (`src/modules/*`) with shared infrastructure under `src/shared/`.

**Audience:** operators and SREs responsible for installing, running, and recovering this service and its dependencies.

---

## External libraries and frameworks (npm)

| Dependency | Role |
|------------|------|
| **fastify** | HTTP server, routing, plugins, lifecycle hooks. |
| **@fastify/cors** | CORS for browser clients (credentials-aware; production must use explicit origins). |
| **@fastify/cookie** | Parse and set cookies (session id for `AuthSessionStore`). |
| **jose** | Verify OIDC access tokens (JWKS, issuer, audience, signature). |
| **pg** | PostgreSQL client; all durable app data goes through `shared/db.ts` pools. |
| **ioredis** | Optional **Redis** client when `AUTH_SESSION_STORE=redis` (production-style session backing). |
| **zod** | Request body and params validation in route handlers. |
| **sanitize-html** | Allowlisted HTML sanitization for document content on write (with plain-title stripping in shared code). |
| **@fastify/aws-lambda** | Optional deployment shape: adapt the app for **AWS Lambda** + API Gateway (`src/lambda.ts`). |

**Tooling (dev / build / migrations, not loaded in production runtime unless you run them):** `typescript`, `tsx`, `vitest`, `supertest`, `dotenv-cli`, `node-pg-migrate`, `@types/*`.

---

## External services and technologies (required or optional)

| Service / technology | Required? | Used for |
|----------------------|-----------|----------|
| **PostgreSQL** | **Yes** for normal operation | Application database: documents, user settings, audit events. Migrations live in `migrations/`. |
| **Keycloak** | **Yes** for authenticated flows | OIDC issuer, JWKS, resource-owner password grant (login), Admin REST API (register user, send password-reset email). The app does not store user passwords. |
| **Redis** | **Optional** | Server-side session storage when `AUTH_SESSION_STORE=redis`. If unset, **in-memory** sessions are used (dev-only; **disallowed in production** in `app.ts`). |
| **SMTP / Mailpit** | **Optional for login** | Keycloak sends email for password reset; in Docker, **Mailpit** receives SMTP and exposes a web UI. Dev signup may bypass strict email verification depending on realm configuration. |

**Identity storage:** user accounts and credentials live in **Keycloak’s** database (embedded store in Keycloak `start-dev`, or a configured DB in real deployments—not created by this Node app).

---

## Databases: what this codebase creates and uses

All **application** relational state is in the database named in **`DATABASE_URL`** (Compose uses database **`glossadocs`** on the `postgres` service). The backend **does not** provision the Postgres instance; it **creates schema** via **node-pg-migrate** migrations.

| Migration (order) | Creates / enables | Read/write by (conceptual) |
|-------------------|-------------------|----------------------------|
| `000_enable_pgcrypto.js` | PostgreSQL **`pgcrypto`** extension | Document encryption at rest (when `DOCUMENT_ENCRYPTION_KEY` is set). |
| `001_create_documents.js` | Table **`documents`** + indexes | Document module: CRUD by `owner_id`. |
| `002_create_user_settings.js` | Table **`user_settings`** | Input preferences: get/put settings per `owner_id`. |
| `003_create_api_audit_events.js` | Table **`api_audit_events`** + index on `created_at` | Operational store: append-only audit rows on mutating HTTP methods. |
| `004_create_folders_and_document_folder_fk.js` | Table **`folders`**, `documents.folder_id`, folder indexes/FKs | Document organization: nested folders and folder-assigned documents by `owner_id`. |
| `005_add_documents_font_family.js` | `documents.font_family` | Per-document language-aware font theme persistence. |

**Redis** is not a “database” in the DDL sense: keys are **`{AUTH_REDIS_KEY_PREFIX}{sessionId}`** holding JSON with access token metadata when using `RedisAuthSessionStore`.

**Keycloak** has its own persistence; this repo supplies a **realm import** for Docker (`docker/keycloak/realm-export.json`) but does not run Keycloak migrations from Node.

---

## Install

1. **Node.js 20+** and npm.
2. From repo root (or this directory):

   ```bash
   npm install
   npm --prefix backend install
   ```

3. **Configuration:** copy `backend/.env.example` to `backend/.env` and set at least `DATABASE_URL`, OIDC/Keycloak variables, and session options as required by your environment. For local Keycloak matching the example files, use the issuer and token URLs that match how browsers and containers reach Keycloak (`localhost` vs Docker service names—see comments in `.env.example`).

---

## Start and stop

### Docker Compose (recommended full stack)

From the **repository root** (runs API, Postgres, Keycloak, Mailpit, frontend). You do **not** need `npm install` on the host for this path: images build with `npm ci` inside Docker. You **do** need the Docker daemon running.

```bash
npm run dev:docker
```

Equivalent without Node/npm: `docker compose up --build`. Stop with `npm run dev:docker:down` or `docker compose down`.

The backend container runs migrations on startup (`node-pg-migrate up`) then `node dist/server.js`.

**Stop (containers down; volumes kept unless you use `-v`):**

```bash
npm run dev:docker:down
```

### Local Node (no Docker for the API)

Requires PostgreSQL and Keycloak (or equivalent) reachable per `.env`.

```bash
cd backend
npm run migrate:up    # apply migrations
npm run dev           # tsx watch src/server.ts with dotenv
```

**Production-style start** (after `npm run build`):

```bash
npm run start
```

---

## Reset application data and storage (SRE runbook)

Use these when you need a **clean slate** for development or after a bad migration state. **Production resets require backups and a change window.**

### Docker: reset Postgres data

**All app rows** (documents, settings, audit) live in the Compose-managed Postgres volume. Remove volumes when tearing down:

```bash
docker compose down -v
npm run dev:docker
```

If you need to remove a volume manually, list volumes with `docker volume ls` (the Postgres volume name depends on your Compose project name and the volume key `postgres_data` in `docker-compose.yml`).

On next start, migrations recreate empty tables, and Compose rebuilds images if needed. Keycloak dev realm may re-import from `realm-export.json`; app data is still empty until users create documents again.

### Local Postgres (non-Docker)

1. Drop and recreate the database (or drop public schema objects), **or** point `DATABASE_URL` at a fresh database.
2. Run `npm run migrate:up` from `backend/`.

### Redis sessions

If using Redis, flushing keys with prefix `AUTH_REDIS_KEY_PREFIX` logs users out server-side; combine with cookie expiry as needed.

### Keycloak users

User accounts are **not** stored in the app DB. To reset test users, use the Keycloak admin UI or realm re-import; see project Docker docs and `docker/keycloak/`.

---

## Health and readiness

- **Liveness:** `GET /health` → `{ "status": "ok" }`
- **Readiness:** `GET /ready` → currently static; can be extended to check DB connectivity.

---

## Tests and typecheck

```bash
npm test
npm run typecheck
```

---

## Further documentation

- [System architecture](../docs/architecture/system.md)
- [Module index](../docs/architecture/backend-architecture.md)
- [Document encryption](../docs/architecture/document-encryption.md)
- Language font catalog used for validation: `src/shared/document-fonts.ts`

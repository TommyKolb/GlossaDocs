# GlossaDocs

GlossaDocs is a browser-based document editor inspired by Google Docs, aimed at **multilingual writing**: per-document language, on-screen keyboards and key remapping for non-Latin scripts (for example Russian), and a familiar flow—document list, rich-text editor, autosave, import/export.

**Why it exists:** many tools treat language as an afterthought. GlossaDocs is built so language choice and input methods sit next to editing, not in a separate toolchain.

**Privacy:** your email is used for sign-in and account recovery only. We do not sell it or use it for marketing. Passwords are handled by **Keycloak**, not stored in GlossaDocs application code.

## Architecture (high level)

- **Frontend:** React (Vite), rich text via `contentEditable`, local **guest** mode (IndexedDB) or **authenticated** mode talking to the API.
- **Backend:** single **Fastify** service (modular monolith)—JWT verification, cookie-backed sessions, REST for documents and user settings, HTML sanitization, optional encryption at rest in PostgreSQL.
- **Identity:** **Keycloak** (OIDC). The app does not store passwords; login, signup, and password reset go through Keycloak (and the Admin API where needed).

Deeper detail: [docs/architecture/backend-architecture.md](docs/architecture/backend-architecture.md) and [docs/architecture/system.md](docs/architecture/system.md). Backend operations (dependencies, data stores, runbooks): [backend/README.md](backend/README.md).

## Run the application (use Docker first)

**Docker Compose is the easiest way** to run the full stack: frontend, API, PostgreSQL, Keycloak, and Mailpit (captured email for dev).

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. From the repo root:
   ```bash
   npm run dev:docker
   ```
3. When containers are healthy, open:
   - **App:** [http://localhost:5173](http://localhost:5173)
   - **API health:** [http://localhost:4000/health](http://localhost:4000/health)
   - **Keycloak admin console:** [http://localhost:8080](http://localhost:8080) — `admin` / `admin`
   - **Mailpit (dev inbox):** [http://localhost:8025](http://localhost:8025)

**Stop the stack:**

```bash
npm run dev:docker:down
```

### Docker dev login (pre-seeded user)

Use these to sign in in **authenticated** mode without registering:

- **Email:** `devuser@example.com`
- **Password:** `devpass`

The Docker backend is configured so token verification uses the **internal** Keycloak URL (`http://keycloak:8080/...`) while browsers use `localhost`. You can also use **Create account** on the login screen; outbound mail is optional in dev, and password-reset messages appear in Mailpit.

## Other ways to run

| Goal | Command / steps |
|------|-------------------|
| **Frontend only, no database** | `npm install` → `npm run dev:guest` → open [http://localhost:5173](http://localhost:5173) and choose **Continue as Guest** (IndexedDB + localStorage only). |
| **Full stack without Docker** | Node 20+, local PostgreSQL and Keycloak, then `npm run setup:dev`, copy `.env` / `backend/.env` from `.env.example` files, `npm run migrate:all`, `npm run dev:all`. See [backend/README.md](backend/README.md). |

**API URL for the frontend:** set `VITE_API_BASE_URL` (defaults to `http://localhost:4000`).

## Tests

- Frontend: `npm run test:frontend` (Vitest, `src/test/`)
- Backend: `npm run test:backend` (Vitest, `backend/test/`)

## Further reading

- [Document encryption at rest](docs/architecture/document-encryption.md) (`DOCUMENT_ENCRYPTION_KEY`)
- Operational concerns (sessions, Postgres, Keycloak, reset procedures): **[backend/README.md](backend/README.md)**

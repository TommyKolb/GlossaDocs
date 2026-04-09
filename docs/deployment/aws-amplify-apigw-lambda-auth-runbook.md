# AWS Deployment Completion Runbook (Next Branch)

This runbook captures:

- what has already been implemented in this branch (auth foundation),
- the chosen AWS database strategy, and
- the exact next-branch process to complete deployment to Amplify + API Gateway + Lambda + Cognito.

Current branch foundation:

- Frontend target: AWS Amplify
- API target: API Gateway -> Lambda (`backend/src/lambda.ts`)
- Production auth provider: Cognito
- Local development: `APP_ENV=dev` + Keycloak/Docker defaults

## 1) Database Strategy Decision

### Chosen strategy

- **Primary DB:** Amazon RDS for PostgreSQL
- **Lambda connection path:** **RDS Proxy** (required for Lambda runtime)
- **Session store:** ElastiCache Redis (`AUTH_SESSION_STORE=redis`)

### Why this option

- Minimal app changes from current PostgreSQL model
- Strong operational fit for Lambda connection management
- Predictable migration path from existing local/Postgres workflows

### Options considered


| Option                          | Decision   | Notes                                             |
| ------------------------------- | ---------- | ------------------------------------------------- |
| RDS PostgreSQL + RDS Proxy      | **Chosen** | Best balance of risk, effort, and reliability     |
| Aurora PostgreSQL Serverless v2 | Deferred   | Viable later if autoscaling pressure justifies it |
| Self-managed PostgreSQL         | Rejected   | High ops burden for this project stage            |


## 2) Environment Modes and Provider Selection

Use one switch to control behavior:

- `APP_ENV=dev`:
  - default `AUTH_PROVIDER=keycloak`
  - local-friendly cookie/session defaults
  - supports account creation in local Docker dev (or guest mode in frontend)
- `APP_ENV=prod`:
  - default `AUTH_PROVIDER=cognito`
  - strict config validation (secure cookies, explicit CORS origins, Redis sessions)
  - fails fast if required Cognito config is missing

## 2) Required Production Variables (Auth + Session)

Backend (`backend/.env` or Lambda environment):

- `APP_ENV=prod`
- `AUTH_PROVIDER=cognito`
- `CORS_ALLOWED_ORIGINS=https://<your-amplify-domain>`
- `AUTH_SESSION_SECURE_COOKIE=true`
- `AUTH_SESSION_STORE=redis`
- `REDIS_URL=<elasticache-connection-url>`
- `DATABASE_URL=<rds-proxy-connection-string>`
- `COGNITO_REGION=<region>`
- `COGNITO_USER_POOL_ID=<user-pool-id>`
- `COGNITO_CLIENT_ID=<app-client-id>`
- `COGNITO_CLIENT_SECRET=<optional; only if client uses secret>`
- `COGNITO_PUBLIC_DOMAIN=https://<your-cognito-domain>` (for `/auth/public`)
- `OIDC_PUBLIC_REDIRECT_URI=https://<your-amplify-domain>/auth/callback`

Optional and auto-derived when omitted in Cognito mode:

- `OIDC_ISSUER_URL` (derived from region + user pool)
- `OIDC_AUDIENCE` (derived from `COGNITO_CLIENT_ID`)

Frontend (Amplify env vars):

- `VITE_API_BASE_URL=https://<api-gateway-domain-or-custom-domain>`

## 3) Next-Branch Implementation Process (Required)

Execute in this order:

1. **Infrastructure as code**
  - Provision Cognito (user pool, app client, hosted UI domain)
  - Provision RDS PostgreSQL and RDS Proxy
  - Provision ElastiCache Redis
  - Provision Lambda + API Gateway + IAM
  - Provision Amplify app/branch config
2. **Backend production wiring**
  - Point `DATABASE_URL` to RDS Proxy
  - Set production Redis and Cognito variables
  - Finalize cookie and CORS settings for real domains
3. **Frontend production wiring**
  - Set Amplify `VITE_API_BASE_URL` to API Gateway/custom domain
  - Validate sign-in/sign-up/password-reset and authenticated CRUD
4. **Migration and release workflow**
  - Run `node-pg-migrate` in CI/release job before Lambda traffic shift
  - Deploy Lambda only after successful migrations
5. **Go-live hardening**
  - Add API Gateway throttling/WAF baseline
  - Add CloudWatch alarms and post-deploy smoke tests

## 4) CI/CD Automation Requirement (Next Branch)

The next branch must implement **fully automatic deployment from GitHub Actions**:

- Trigger: merge/push to `main`
- Gate: required tests/typecheck must pass before deploy
- Outcome: all deployment steps run without manual intervention

Required automated stages in GitHub Actions:

1. Run test gates
2. Apply infrastructure changes
3. Run database migrations
4. Deploy backend Lambda/API changes
5. Deploy frontend updates (Amplify)
6. Run post-deploy smoke checks

Manual steps should be limited to one-time environment/bootstrap setup (for example IAM/OIDC trust and initial resource provisioning). Day-to-day deployments after merge to `main` must be hands-off.

## 5) API Gateway + Lambda Wiring

- Build backend (`npm --prefix backend run build`).
- Deploy Lambda using `backend/src/lambda.ts` handler.
- Configure API Gateway with Lambda proxy integration for the backend routes.
- Ensure API Gateway custom domain/TLS is configured before enforcing strict production CORS origins.

## 6) Migration Execution Strategy

Do not run `node-pg-migrate` inside Lambda invocations.

Use a dedicated migration step during release:

1. Deploy database migration job (or CI step) using backend package.
2. Run `npm --prefix backend run migrate:up` against production `DATABASE_URL` (RDS Proxy endpoint).
3. Deploy Lambda code after successful migrations.

## 7) Auth Endpoint Contract (Stable)

The frontend continues to use the same API contract:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/session`
- `POST /auth/register`
- `POST /auth/password-reset`
- `GET /auth/public`

Provider-specific logic is now behind backend auth provider clients, allowing Cognito in production and local-friendly dev mode without changing frontend endpoint usage.

## 8) Deployment Test Gate (Required)

Before merge or release:

1. Backend typecheck and tests:
  - `npm --prefix backend run typecheck`
  - `npm --prefix backend test`
2. Frontend tests:
  - `npm test`
3. Verify CI is green for changed backend/frontend test jobs.

The next deployment branch is not merge-ready unless this matrix is green.

## 9) Done Criteria For AWS Deployment Branch

All items below must be true:

- Amplify serves production frontend with correct API base URL
- API Gateway routes to Lambda successfully for all `/auth/`*, `/me`, `/documents`, `/folders`, `/settings`
- Cognito registration/login/password-reset flows work end-to-end
- RDS PostgreSQL is reachable through RDS Proxy from Lambda
- Redis session store is healthy in production mode
- CI/CD migration step runs before Lambda release
- Post-deploy smoke tests and alarms are in place


# AWS Deployment Runbook

This runbook captures the current production deployment process to Amplify + API Gateway + Lambda + Cognito.

Companion setup for maintainers deploying from a fork:

- `docs/deployment/aws-fork-bootstrap.md`

Current branch foundation:

- Frontend target: AWS Amplify
- API target: API Gateway -> Lambda (`backend/src/lambda.ts`)
- Production auth provider: Cognito
- Local development: `APP_ENV=dev` + Keycloak/Docker defaults

## 1) Database Strategy Decision

### Current strategy

- **Primary DB:** Amazon RDS for PostgreSQL
- **Lambda connection path:** direct TLS connection to the RDS instance endpoint
- **Session store:** ElastiCache Redis (`AUTH_SESSION_STORE=redis`)
- **Migration execution:** CodeBuild project in app private subnets triggered by GitHub Actions before app deployment

### Why this option

- Minimal app changes from current PostgreSQL model
- Removes always-on RDS Proxy baseline cost
- Predictable migration path from existing local/Postgres workflows

### Options considered


| Option                          | Decision   | Notes                                             |
| ------------------------------- | ---------- | ------------------------------------------------- |
| RDS PostgreSQL (direct TLS)     | **Chosen** | Lowest baseline cost for current traffic profile   |
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

Invalid combination note:

- `NODE_ENV=production` with `APP_ENV=dev` is rejected at startup.
- `APP_ENV=prod` with `AUTH_PROVIDER=keycloak` is rejected at startup.

## 3) Required Production Variables (Auth + Session)

Backend (`backend/.env` or Lambda environment):

- `APP_ENV=prod`
- `AUTH_PROVIDER=cognito`
- `CORS_ALLOWED_ORIGINS=https://<your-amplify-domain>`
- `AUTH_SESSION_SECURE_COOKIE=true`
- `AUTH_SESSION_STORE=redis`
- `REDIS_URL=<elasticache-connection-url>`
- `DATABASE_URL=<rds-connection-string-with-sslmode=require>`
- **RDS CA bundle:** the backend ships AWS’s public RDS CA PEM at `backend/certs/rds-global-bundle.pem` and uses it for TLS verification to RDS. Do not omit it from Lambda packaging; production will not start verified TLS without it (or an explicit `RDS_CA_BUNDLE_PATH`). `DATABASE_TLS_INSECURE` is not valid in `APP_ENV=prod`.
- `COGNITO_REGION=<region>`
- `COGNITO_USER_POOL_ID=<user-pool-id>`
- `COGNITO_CLIENT_ID=<app-client-id>`
- `COGNITO_CLIENT_SECRET=<optional; only if client uses secret>`
- `COGNITO_PUBLIC_DOMAIN=https://<your-cognito-domain>` (for `/auth/public`)
- `OIDC_PUBLIC_REDIRECT_URI=https://<your-amplify-domain>/auth/callback`

Optional and auto-derived when omitted in Cognito mode:

- `OIDC_ISSUER_URL` (derived from region + user pool)
- `OIDC_AUDIENCE` (derived from `COGNITO_CLIENT_ID`)
- `OIDC_JWKS_URL` (derived as `${OIDC_ISSUER_URL}/.well-known/jwks.json`)

Frontend (Amplify env vars):

- `VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/<stage>` — **base URL only** (include the stage, e.g. `/prod`; no trailing slash; do **not** append `/auth/login` or other paths). The app calls `POST /auth/login`, `POST /auth/register`, etc. via `fetch`.

**API Gateway console:** A Lambda proxy API often shows **`ANY`** and **`OPTIONS`** on `/{proxy+}` — that is normal: **`ANY`** forwards all HTTP methods (GET, POST, …) to Lambda. Login and sign-up are **`POST`** JSON requests from the SPA, not browser navigations to GET URLs. Opening `https://…/prod/auth/login` in a tab sends **GET**, which the API does not use for credentials (you should see **405 Method Not Allowed** with `Allow: POST` after the backend update that documents this).

**Sign-up passwords (Cognito):** The CDK user pool enforces a **strong** password policy (minimum length 12, uppercase, lowercase, number, symbol). The app-hosted **Create account** form and API validation must match that policy; otherwise Cognito’s `SignUp` API fails and the API previously surfaced a generic **`AUTH_IDP_UNAVAILABLE`** (**502**). Prefer clear **400** responses and UI copy after aligning validation with the pool (see `cognito-password-policy` in the backend and `UserPool` `passwordPolicy` in `glossadocs-stack.ts`).

**Sign-up without email verification:** By default, Cognito `SignUp` creates an **UNCONFIRMED** user until the user verifies email; **`USER_PASSWORD_AUTH` login then fails** (often surfaced as **`AUTH_IDP_UNAVAILABLE`** / **502**). The backend calls **`AdminConfirmSignUp`** immediately after a successful `SignUp`, and the API Lambda IAM role includes **`cognito-idp:AdminConfirmSignUp`** on the user pool so new accounts can sign in without a verification step. **Accounts created before this behavior** may still be UNCONFIRMED: confirm them in the Cognito console (**Users** → select user → **Confirm user**) or register again with a different email.

## 4) One-Time AWS Bootstrap (Before First Merge to `main`)

Complete this checklist once per AWS account/region/repository before the first production merge:

1. **Choose production target**
  - Select AWS account and region for production.
  - Create AWS Budgets alerts and billing notifications.
2. **Configure GitHub Actions -> AWS trust (OIDC)**
  - Add GitHub OIDC identity provider in IAM.
  - Create deploy IAM role trusted by this repository/workflow.
  - Grant least-privilege permissions required for CDK/CloudFormation, IAM pass-role, Lambda, API Gateway, Amplify, Cognito, RDS, ElastiCache, CodeBuild, S3, EC2 networking, and CloudWatch.
3. **Bootstrap CDK**
  - Run `cdk bootstrap aws://<account-id>/<region>` for the production target.
  - Confirm bootstrap stack/resources exist.
4. **Prepare domain and TLS plan**
  - Decide whether to use default Amplify/API domains initially or custom domains now.
  - If custom domains are used, verify hosted zone ownership and certificate flow.
5. **Configure repository deploy settings**
  - Add required GitHub repository/environment secrets and variables (role ARN, region, and any required deploy-time settings).
  - Configure branch/environment protections as desired.
6. **Run initial infrastructure deploy**
  - Run first `cdk deploy` from this branch and capture outputs (API URL, Cognito identifiers/domain, DB and Redis secret references).
7. **Finalize Cognito and frontend URLs**
  - Set Cognito callback and logout URLs to actual frontend domains.
  - Confirm callback path matches frontend behavior (for example `/auth/callback`).
8. **Set production runtime configuration**
  - Ensure backend receives required production variables (`APP_ENV=prod`, Cognito values, `DATABASE_URL` direct to RDS with TLS, `REDIS_URL`, strict CORS origin).
  - Ensure Amplify has `VITE_API_BASE_URL` set to production API.
9. **Run first migrations and smoke checks**
  - Trigger the production workflow migration stage (VPC CodeBuild) and confirm it succeeds.
  - Verify `/health`, `/ready`, auth flow, and one authenticated CRUD route.
10. **Enable alarms and rollback readiness**
  - Confirm CloudWatch alarms are active.
  - Confirm rollback procedure is documented and tested at least once.

After this checklist is complete, merges to `main` should be able to deploy without additional manual AWS setup.

## 5) Recommended Release Flow

Use this order for safe rollout and pipeline validation:

1. Implement deployment code on feature branch.
2. Open/merge PR to `develop` for integration confidence.
3. Open PR to `main`; ensure all required checks are green.
4. Merge to `main` to trigger automated deploy pipeline.
5. Confirm post-deploy smoke checks and alarms are healthy.

Important: do **not** wait to merge to `main` until after production is already live.  
The `main` merge should be the event that triggers the first automated production deployment once bootstrap is done.

## 6) Deployment Implementation Order

Execute in this order:

1. **Infrastructure as code**
  - Provision Cognito (user pool, app client, hosted UI domain)
  - Provision RDS PostgreSQL (direct endpoint access from Lambda)
  - Provision ElastiCache Redis
  - Provision Lambda + API Gateway + IAM
  - Provision Amplify app/branch config
2. **Backend production wiring**
  - Point `DATABASE_URL` to the RDS endpoint with TLS required
  - Set production Redis and Cognito variables
  - Finalize cookie and CORS settings for real domains
3. **Frontend production wiring**
  - Set Amplify `VITE_API_BASE_URL` to API Gateway/custom domain
  - Validate sign-in/sign-up/password-reset and authenticated CRUD
4. **Migration and release workflow**
  - Run `node-pg-migrate` in VPC-attached CodeBuild before Lambda traffic shift
  - Deploy Lambda only after successful migrations
5. **Go-live hardening**
  - Add API Gateway throttling/WAF baseline
  - Add CloudWatch alarms and post-deploy smoke tests

## 7) CI/CD Automation Requirement

Deployment is fully automated from GitHub Actions:

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

Repository workflows expected after implementation:

- `.github/workflows/tests.yml` (test orchestrator)
- `.github/workflows/run-infrastructure-tests.yml` (infra typecheck/lint/assert/synth)
- `.github/workflows/infrastructure-diff.yml` (PR dry-run diff visibility)
- `.github/workflows/deploy-production.yml` (main-branch automated release)

## 8) API Gateway + Lambda Wiring

- Build backend (`npm --prefix backend run build`).
- Deploy Lambda using `backend/src/lambda.ts` handler.
- Configure API Gateway with Lambda proxy integration for the backend routes.
- Ensure API Gateway custom domain/TLS is configured before enforcing strict production CORS origins.

## 9) Migration Execution Strategy

Do not run `node-pg-migrate` inside Lambda invocations.

Use a dedicated migration step during release:

1. Deploy database migration job (or CI step) using backend package.
2. Trigger the VPC CodeBuild migration project from CI using the uploaded backend source bundle.
3. Deploy Lambda code after successful migrations.

## 10) Auth Endpoint Contract (Stable)

The frontend continues to use the same API contract:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/session`
- `POST /auth/register`
- `POST /auth/password-reset`
- `GET /auth/public`

Provider-specific logic is now behind backend auth provider clients, allowing Cognito in production and local-friendly dev mode without changing frontend endpoint usage.

## 11) Deployment Test Gate (Required)

Before merge or release:

1. Backend typecheck and tests:
  - `npm --prefix backend run typecheck`
  - `npm --prefix backend test`
2. Frontend tests:
  - `npm test`
3. Verify CI is green for changed backend/frontend test jobs.

Infrastructure deployment code checks:

4. CDK tests and synth:
  - `npm --prefix infrastructure run typecheck`
  - `npm --prefix infrastructure run lint`
  - `npm --prefix infrastructure run test`
  - `npm --prefix infrastructure run synth`
5. Deploy workflow prechecks:
  - Required AWS/GitHub variables and secrets validation passes
  - Migration job succeeds before application deployment continues
  - Smoke checks pass after deploy

The deployment branch is not merge-ready unless this matrix is green.

## 12) Done Criteria For Deployment Branch

All items below must be true:

- Amplify serves production frontend with correct API base URL
- API Gateway routes to Lambda successfully for all `/auth/`*, `/me`, `/documents`, `/folders`, `/settings`
- Cognito registration/login/password-reset flows work end-to-end
- RDS PostgreSQL is reachable directly from Lambda with TLS
- Redis session store is healthy in production mode
- CI/CD migration step runs before Lambda release
- Post-deploy smoke tests and alarms are in place

## 13) Rollback Baseline

If post-deploy smoke checks fail:

1. Stop further release steps and keep failed deploy artifacts for investigation.
2. Roll API/Lambda back to the previous known-good deployment (previous stack/app revision).
3. If the failure was migration-related, restore from backup/snapshot according to your DB recovery policy before reopening traffic.
4. Re-run `/health` and `/ready`, then auth + CRUD smoke checks.
5. Document root cause and fix forward before the next `main` deployment.


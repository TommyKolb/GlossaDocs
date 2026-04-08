# AWS Auth Foundation Runbook

This runbook covers the auth-focused deployment foundation implemented in this branch:

- Frontend hosted in AWS Amplify
- API exposed through API Gateway to Lambda (`backend/src/lambda.ts`)
- Production auth provider set to Cognito
- Local development remains easy with `APP_ENV=dev` and Keycloak/Docker defaults

Full non-auth deployment hardening (network topology, WAF, scaling, migration automation) is tracked for the next branch.

## 1) Environment Modes and Provider Selection

Use one switch to control behavior:

- `APP_ENV=dev`:
  - default `AUTH_PROVIDER=keycloak`
  - local-friendly cookie/session defaults
  - allows Docker-based `devuser@example.com` / `devpass`
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

## 3) API Gateway + Lambda Wiring

- Build backend (`npm --prefix backend run build`).
- Deploy Lambda using `backend/src/lambda.ts` handler.
- Configure API Gateway with Lambda proxy integration for the backend routes.
- Ensure API Gateway custom domain/TLS is configured before enforcing strict production CORS origins.

## 4) Migration Execution Strategy

Do not run `node-pg-migrate` inside Lambda invocations.

Use a dedicated migration step during release:

1. Deploy database migration job (or CI step) using backend package.
2. Run `npm --prefix backend run migrate:up` against production `DATABASE_URL`.
3. Deploy Lambda code after successful migrations.

## 5) Auth Endpoint Contract (Stable)

The frontend continues to use the same API contract:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/session`
- `POST /auth/register`
- `POST /auth/password-reset`
- `GET /auth/public`

Provider-specific logic is now behind backend auth provider clients, allowing Cognito in production and local-friendly dev mode without changing frontend endpoint usage.

## 6) Test Gate (Required)

Before merge or release:

1. Backend typecheck and tests:
   - `npm --prefix backend run typecheck`
   - `npm --prefix backend test`
2. Frontend tests:
   - `npm test`
3. Verify CI is green for changed backend/frontend test jobs.

The branch is not merge-ready unless this matrix is green.

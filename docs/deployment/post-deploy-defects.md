# Post-Deploy Defects and Follow-Ups

This document tracks application-level issues discovered after successful AWS deployment validation.

Scope:

- Deployment stack is functioning (Amplify, API Gateway, Lambda, Cognito, RDS Proxy, Redis).
- Items below are product/auth behavior bugs or UX gaps to address in follow-up PRs.

## Status snapshot

- `/health`: passing
- `/ready`: passing
- Auth register/login against deployed API: functioning with Cognito configuration adjustments
- Remaining issues: logout UX, guest/account data separation, verification UX gap

## Defects

## 1) Missing logout action in authenticated UI

- Severity: medium
- Area: frontend auth/session UX
- Symptom: user cannot find a logout button after logging in.
- Expected: authenticated users can clearly sign out from primary navigation/profile menu.
- Impact: users may be unable to end sessions intentionally.
- Proposed fix:
  - Add explicit logout control in authenticated layout.
  - Wire control to `POST /auth/logout`.
  - Clear local auth/session UI state after successful response.
- Suggested verification:
  - Login, click logout, confirm redirected/auth-cleared state.
  - Confirm `GET /auth/session` returns unauthorized after logout.

## 2) Guest document appears in authenticated account

- Severity: high
- Area: frontend data/session mode transitions
- Symptom: document created in guest mode is visible after authenticated login.
- Expected: guest-mode local documents remain separate from authenticated server documents unless explicit import/merge is performed.
- Impact: privacy and data-boundary violation between local guest storage and account storage.
- Proposed fix:
  - Audit guest-mode storage vs authenticated repository switch logic.
  - Ensure no automatic silent upload/merge of guest documents on login.
  - If migration is desired, implement explicit opt-in import flow with clear user confirmation.
- Suggested verification:
  - Create guest doc while logged out.
  - Login with account and verify account list excludes guest doc by default.
  - Logout and verify guest doc still exists only in guest mode.

## 3) No verification-code entry flow for Cognito sign-up

- Severity: medium
- Area: auth flow completeness
- Symptom: signup can trigger verification email, but app has no UI flow to confirm code.
- Expected: either
  - app supports code confirmation UX, or
  - Cognito is configured to not require confirmation for current release policy.
- Current temporary decision: use Option C (disable verification requirement) until confirmation UX is implemented.
- Proposed fix options:
  - Implement confirm-signup UI + backend endpoint support, or
  - Move to Cognito Hosted UI flow for confirmation.
- Suggested verification:
  - Register new account and complete required confirmation path fully within supported UX.

## Temporary production choice (current)

Use Option C until full confirmation UX exists:

- Configure Cognito app policy so newly registered users are immediately usable without manual admin confirmation.
- Document this as a temporary release trade-off and track removal in a follow-up task.

## Follow-up execution plan

1. Validate CI/CD flow `develop` -> `main` with current deployment automation.
2. Open dedicated bugfix branch for the three defects above.
3. Fix and verify defects with integration tests where practical.
4. Re-enable stricter verification flow after confirmation UX exists.

## Temporary CI/CD workaround (must be removed)

- Current constraint: GitHub-hosted runners cannot connect to private RDS Proxy endpoints in VPC.
- Temporary pipeline unblock: set production variable `SKIP_DB_MIGRATIONS=true` to bypass migration step in `deploy-production.yml`.
- This is a hack and should only be used after migrations are manually run from inside VPC.
- Required follow-up:
  - Implement VPC-reachable migration execution (recommended: CodeBuild project in VPC).
  - Remove `SKIP_DB_MIGRATIONS` bypass and restore strict migration gate before app deployment.


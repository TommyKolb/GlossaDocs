# Post-Deploy Defects and Follow-Ups

This document tracks application-level issues discovered after successful AWS deployment validation.

Scope:

- Deployment stack is functioning (Amplify, API Gateway, Lambda, Cognito, direct RDS, Redis, VPC CodeBuild migrations).
- Items below are product/auth behavior bugs or UX gaps to address in follow-up PRs.

## Status snapshot

- `/health`: passing
- `/ready`: passing
- Auth register/login against deployed API: functioning with Cognito configuration adjustments
- Remaining issues: verification UX gap

## Defects

## 1) Missing logout action in authenticated UI

- Status: resolved in current branch

- Severity: medium
- Area: frontend auth/session UX
- Symptom: user cannot find a logout button after logging in.
- Expected: authenticated users can clearly sign out from primary navigation/profile menu.
- Impact: users may be unable to end sessions intentionally.
- Implemented fix:
  - Added explicit logout/session reset controls in the document-list hero.
  - Wired control to `POST /auth/logout` with local auth/session reset fallback.
  - Reloads app shell after reset to avoid stale in-memory state.
- Suggested verification:
  - Login, click logout, confirm redirected/auth-cleared state.
  - Confirm `GET /auth/session` returns unauthorized after logout.

## 2) Guest document appears in authenticated account

- Status: resolved in current branch

- Severity: high
- Area: frontend data/session mode transitions
- Symptom: document created in guest mode is visible after authenticated login.
- Expected: guest-mode local documents remain separate from authenticated server documents unless explicit import/merge is performed.
- Impact: privacy and data-boundary violation between local guest storage and account storage.
- Implemented fix:
  - Added session-mode gating through `getEffectiveUser()`/`isAuthenticatedMode()`.
  - Reset remote document id cache during login/logout/guest transitions.
  - Kept guest storage local-only with no automatic import into authenticated mode.
- Suggested verification:
  - Create guest doc while logged out.
  - Login with account and verify account list excludes guest doc by default.
  - Logout and verify guest doc still exists only in guest mode.

## 3) No verification-code entry flow for Cognito sign-up

- Status: open

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

## Deployment pipeline status (current)

- Migrations execute in a VPC-attached CodeBuild project before application deployment.
- Production release remains blocked until migration build reports success.
- GitHub-hosted runners no longer run direct DB migrations against private endpoints.


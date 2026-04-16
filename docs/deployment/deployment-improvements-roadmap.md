# Deployment Improvements Roadmap

This document summarizes deployment-related improvements identified during the first end-to-end AWS rollout.

It is intentionally high-level and intended as a practical checklist for follow-up work.

## Current state (what is working)

- Infrastructure deploys via CDK to AWS (Amplify, API Gateway, Lambda, Cognito, direct RDS, Redis, VPC CodeBuild migration runner).
- Main health endpoints are operational:
  - `/health` passes
  - `/ready` passes (after TLS/database URL and Lambda packaging fixes)
- GitHub Actions deployment pipeline exists and runs end-to-end with current temporary settings.
- Amplify frontend deployment is working (with corrected `VITE_API_BASE_URL`).

## Temporary workarounds (must be removed)

## 1) Database migration bypass in CI

- Previous workaround: `SKIP_DB_MIGRATIONS=true` in production variables.
- Resolution: migrations now run in VPC-attached CodeBuild triggered by GitHub Actions before release.
- Expected behavior: deployment blocks if migration build fails.

## 2) Cognito confirmation flow workaround

- Current temporary choice: allow signup/login without full in-app code-confirmation UX (Option C).
- Why it exists: frontend does not yet provide account confirmation entry flow.
- Target fix:
  - implement confirm-signup UX and backend mapping for Cognito confirmation errors.

## Cost and spend improvements

Current architecture still has idle baseline cost due to always-on managed resources (RDS, Redis, NAT, etc.), while RDS Proxy has been removed.

## Near-term cost controls

- Keep only one active environment.
- Disable duplicate frontend deploy triggers (single deployment orchestrator).
- Lower CloudWatch log retention where acceptable.
- Continue using billing alerts and budgets.

## Structural cost reductions (trade-offs)

- NAT Gateway retained as single-AZ egress to avoid the higher fixed cost of many interface endpoints.
- RDS Proxy removed; Lambda now connects directly to RDS with TLS.
- Consider replacing Redis session store with cheaper temporary option (accepting reliability trade-offs).
- Tear down stack when not actively testing (`cdk destroy` + cleanup of retained resources).

## Deployment pipeline hardening

## 1) Make production deploy gating stricter

- Keep strong required checks before merge.
- Keep post-merge deploy checks and smoke tests.
- Ensure branch protection clearly reflects required checks.

## 2) Fix migration execution architecture

- CodeBuild migration project runs in VPC.
- GitHub Actions triggers migration build and blocks release on failure.
- `SKIP_DB_MIGRATIONS` path removed.

## 3) Keep infrastructure diff stable

- Maintain `infrastructure-diff.yml` auth/config behavior.
- Keep `cdk.context.json` committed for `--no-lookups` checks.

## 4) Keep deployment docs synchronized with reality

- Update runbook when temporary hacks are introduced/removed.
- Keep fork bootstrap guide aligned with actual workflow variables/secrets.

## Security and reliability improvements

- Replace broad temporary IAM permissions with least-privilege policies.
- Keep OIDC trust policy scoped to required repo/branch/environment subjects.
- Add explicit rollback procedure for failed post-deploy smoke tests.
- Continue validating CORS origins and environment variable correctness after domain changes.

## Application-adjacent follow-ups discovered during deployment

- Add logout UI for authenticated users.
- Fix guest/account data separation (guest documents should not silently appear in authenticated account).
- Improve auth error mapping (avoid generic 502 for user-correctable Cognito states).

## Recommended execution order

1. Remove migration bypass by implementing VPC migration runner.
2. Decide and implement cost posture (always-on vs teardown between test cycles).
3. Complete auth confirmation UX and tighten Cognito settings accordingly.
4. Resolve remaining app-level UX/data-boundary bugs.
5. Re-run full deploy validation on `develop` -> `main` with no temporary hacks.

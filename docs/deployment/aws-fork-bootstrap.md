# AWS Fork Bootstrap Guide

This guide is for maintainers who fork GlossaDocs and want a production deployment with minimal manual AWS steps after initial setup.

Target architecture:

- Amplify hosting for frontend
- API Gateway -> Lambda for backend
- Cognito for auth
- RDS PostgreSQL for data (direct TLS connection from Lambda)
- ElastiCache Redis for session storage
- VPC-attached CodeBuild migration runner (triggered from GitHub Actions)

## 1) Prerequisites

Before touching infrastructure:

1. Fork and clone this repository.
2. Confirm Node.js 20+ and npm are installed.
3. Choose one AWS account and one AWS region for production.
4. Turn on AWS Budgets alerts for cost control.
5. Create a GitHub fine-grained token with access to your fork repo.
6. Store that token in AWS Secrets Manager and note the secret ARN.

## 2) One-time AWS + GitHub automation bootstrap

These steps are required once per account/region/repository.

### 2.1 Configure GitHub OIDC trust in AWS

1. Add GitHub OIDC identity provider in IAM.
2. Create an IAM role for GitHub Actions deploy jobs.
3. Restrict trust policy to your repository and target branches.
4. Attach least-privilege permissions for CloudFormation/CDK + services used by this stack (Amplify, API Gateway, Lambda, Cognito, RDS, ElastiCache, CodeBuild, S3, CloudWatch, EC2/VPC, IAM pass role).

### 2.2 Bootstrap CDK

Run once:

```bash
cd infrastructure
npm install
npm run build
npx cdk bootstrap aws://<account-id>/<region>
```

### 2.3 Configure GitHub repository variables and secrets

Create these in GitHub repository settings (Environment `production` recommended):

- Variables:
  - `AWS_ACCOUNT_ID`
  - `AWS_REGION`
  - `GLOSSADOCS_GITHUB_OWNER`
  - `GLOSSADOCS_GITHUB_REPOSITORY`
  - `GLOSSADOCS_GITHUB_TOKEN_SECRET_ARN`
  - `GLOSSADOCS_BACKEND_CORS_ORIGIN`
  - `GLOSSADOCS_ENABLE_WAF` (`true` or `false`)
  - `PROD_API_BASE_URL` (set after first deploy output)
- Secrets:
  - `DEPLOY_AWS_ROLE_ARN`

## 3) First deploy from your fork

### 3.1 Run initial infrastructure deploy from a feature branch

From repo root:

```bash
npm --prefix infrastructure install
npm --prefix infrastructure run build
npm --prefix infrastructure run test
```

Set required environment variables and deploy:

```bash
npm --prefix infrastructure run deploy
```

Capture outputs:

- API base URL
- Amplify default domain
- Cognito user pool ID and client ID
- Cognito hosted domain
- migration project name
- migration source bucket name
- Redis endpoint

### 3.2 Finalize auth and frontend URLs

1. In Cognito app client, set callback/logout URLs to your Amplify domain (and custom domain if used).
2. Ensure callback includes `/auth/callback`.
3. Set Amplify environment variable:
   - `VITE_API_BASE_URL=https://<api-domain>`

### 3.3 Apply first database migration

Trigger migration through the same release path used in production:

```bash
gh workflow run deploy-production.yml
```

The workflow uploads the backend bundle, starts the VPC CodeBuild migration job, and blocks application deployment if migrations fail.

### 3.4 Smoke test

Verify:

- `GET /health`
- `GET /ready`
- login/session flow
- one authenticated CRUD flow (documents or folders)

## 4) Normal day-2 deploy flow

After bootstrap:

1. Open PR and merge to `main`.
2. `deploy-production.yml` runs automatically.
3. Pipeline gates:
   - app tests
   - backend typecheck
   - infrastructure typecheck/lint/tests/synth
   - migration success before app deployment
   - post-deploy smoke checks

No manual AWS console changes should be required for normal releases.

## 5) Cost and teardown

To avoid unexpected charges:

- Keep AWS Budgets alerts enabled.
- Use small instance classes for initial traffic.
- Disable WAF initially if cost-sensitive and risk profile allows.
- Tear down unused environments with `cdk destroy` after confirming data retention requirements.

For production teardown, snapshot/export required data first.

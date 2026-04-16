# GlossaDocs Infrastructure (AWS CDK)

This directory contains AWS CDK infrastructure for public production deployment:

- Amplify frontend hosting
- API Gateway -> Lambda backend
- Cognito user pool + app client + hosted domain
- RDS PostgreSQL (direct Lambda connection, TLS required)
- ElastiCache Redis for session storage
- VPC-attached CodeBuild migration runner + S3 source bundle
- VPC endpoints for private AWS service access (no NAT Gateway)
- CloudWatch alarms and optional WAF baseline

## Prerequisites

- Node.js 20+
- AWS credentials with deploy permissions
- CDK bootstrap completed for target account/region
- GitHub token stored in AWS Secrets Manager (for Amplify repository access)

## Environment variables

Set these before `npm run synth` / `npm run deploy`:

- `GLOSSADOCS_GITHUB_OWNER`
- `GLOSSADOCS_GITHUB_REPOSITORY`
- `GLOSSADOCS_GITHUB_TOKEN_SECRET_ARN`
- `GLOSSADOCS_BACKEND_CORS_ORIGIN`
- `GLOSSADOCS_FRONTEND_CALLBACK_PATH` (optional, default `/auth/callback`)
- `GLOSSADOCS_FRONTEND_LOGOUT_PATH` (optional, default `/`)
- `GLOSSADOCS_ENABLE_WAF` (optional, `true` or `false`, default `false`)

## Commands

```bash
npm install
npm run build
npm run test
npm run synth
npm run diff
npm run deploy
```

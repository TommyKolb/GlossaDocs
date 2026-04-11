import * as cdk from "aws-cdk-lib";

export type StackConfig = {
  account: string;
  region: string;
  githubOwner: string;
  githubRepository: string;
  githubTokenSecretArn: string;
  backendCorsOrigin: string;
  frontendCallbackPath: string;
  frontendLogoutPath: string;
  appEnv: "prod";
  enableWaf: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}

export function loadStackConfig(app: cdk.App): StackConfig {
  const account = process.env.CDK_DEFAULT_ACCOUNT ?? app.node.tryGetContext("account");
  const region = process.env.CDK_DEFAULT_REGION ?? app.node.tryGetContext("region");

  if (!account || !region) {
    throw new Error("CDK account and region must be provided via environment or context.");
  }

  return {
    account,
    region,
    githubOwner: requireEnv("GLOSSADOCS_GITHUB_OWNER"),
    githubRepository: requireEnv("GLOSSADOCS_GITHUB_REPOSITORY"),
    githubTokenSecretArn: requireEnv("GLOSSADOCS_GITHUB_TOKEN_SECRET_ARN"),
    backendCorsOrigin: requireEnv("GLOSSADOCS_BACKEND_CORS_ORIGIN"),
    frontendCallbackPath: process.env.GLOSSADOCS_FRONTEND_CALLBACK_PATH ?? "/auth/callback",
    frontendLogoutPath: process.env.GLOSSADOCS_FRONTEND_LOGOUT_PATH ?? "/",
    appEnv: "prod",
    enableWaf: getBoolean("GLOSSADOCS_ENABLE_WAF", false)
  };
}

import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return value;
}, z.boolean());

const appEnvFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }
  return value;
}, z.enum(["dev", "prod"]));

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: appEnvFromEnv.optional(),
  AUTH_PROVIDER: z.enum(["keycloak", "cognito"]).optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ALLOWED_ORIGINS: z.string().default("*"),
  DATABASE_URL: z.string().optional(),
  OIDC_ISSUER_URL: z.string().optional(),
  OIDC_AUDIENCE: z.string().optional(),
  OIDC_JWKS_URL: z.string().optional(),
  /**
   * Public OIDC/Keycloak values for constructing login/registration URLs in the frontend.
   * These MUST be safe to expose to browsers (no secrets).
   */
  OIDC_PUBLIC_ISSUER_URL: z.string().optional(),
  OIDC_PUBLIC_CLIENT_ID: z.string().optional(),
  OIDC_PUBLIC_REDIRECT_URI: z.string().optional(),
  /** Keycloak Admin API base URL (server-side only). Example: http://keycloak:8080 */
  KEYCLOAK_ADMIN_URL: z.string().optional(),
  /** Keycloak realm name for identities. Example: glossadocs */
  KEYCLOAK_REALM: z.string().optional(),
  /** Admin username (server-side only). */
  KEYCLOAK_ADMIN_USERNAME: z.string().optional(),
  /** Admin password (server-side only). */
  KEYCLOAK_ADMIN_PASSWORD: z.string().optional(),
  /** Keycloak token endpoint used for app-hosted username/password login. */
  KEYCLOAK_TOKEN_URL: z.string().optional(),
  /** Keycloak client id used for app-hosted login. */
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  /** Optional Keycloak client secret for confidential clients. */
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  /** Session cookie name used by backend-managed auth sessions. */
  AUTH_SESSION_COOKIE_NAME: z.string().default("glossadocs_session"),
  /** Session cookie max age in seconds. */
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  /** If true, sets Secure flag on auth session cookie. */
  AUTH_SESSION_SECURE_COOKIE: booleanFromEnv.default(false),
  /** Session backend used by auth routes. */
  AUTH_SESSION_STORE: z.enum(["memory", "redis"]).default("memory"),
  /** Redis URL used when AUTH_SESSION_STORE=redis. */
  REDIS_URL: z.string().optional(),
  /** Prefix for Redis-backed session keys. */
  AUTH_REDIS_KEY_PREFIX: z.string().default("glossadocs:session:"),
  /** Optional key used to encrypt Redis-stored session access tokens at rest. */
  AUTH_SESSION_ENCRYPTION_KEY: z.string().optional(),
  /** Per-IP login rate limit window in milliseconds. */
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /** Per-IP maximum login attempts within the configured window. */
  AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(20),
  /** AWS region for Cognito resources. */
  COGNITO_REGION: z.string().optional(),
  /** Cognito User Pool id used for auth and admin APIs. */
  COGNITO_USER_POOL_ID: z.string().optional(),
  /** Cognito app client id used for auth flows and JWT audience checks. */
  COGNITO_CLIENT_ID: z.string().optional(),
  /** Optional Cognito app client secret for confidential app clients. */
  COGNITO_CLIENT_SECRET: z.string().optional(),
  /** Optional Cognito Hosted UI domain (for /auth/public URLs). */
  COGNITO_PUBLIC_DOMAIN: z.string().optional(),
  /** Base64-encoded 32-byte key for document title/content encryption at rest. Optional. */
  DOCUMENT_ENCRYPTION_KEY: z.string().optional(),
  /**
   * Max JSON request body size in bytes (Fastify `bodyLimit`).
   * Inline images are stored as data URLs in document HTML; the default 1 MiB limit is too small.
   */
  API_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  /**
   * Optional absolute path to the RDS global CA PEM (overrides the vendored file under backend/certs/).
   */
  RDS_CA_BUNDLE_PATH: z.string().optional(),
  /**
   * Dev-only escape hatch: allow PostgreSQL TLS without verifying the server cert when the CA bundle is missing.
   * Never use in production; rejected when APP_ENV=prod.
   */
  DATABASE_TLS_INSECURE: booleanFromEnv.optional().default(false)
});

type RawAppConfig = z.infer<typeof configSchema>;

export interface AppConfig extends Omit<RawAppConfig, "APP_ENV" | "AUTH_PROVIDER"> {
  APP_ENV: "dev" | "prod";
  AUTH_PROVIDER: "keycloak" | "cognito";
}

function requireConfigValue(
  value: string | undefined,
  code: string,
  message: string,
  shouldEnforce: boolean
): void {
  if (shouldEnforce && (!value || value.trim().length === 0)) {
    throw new Error(`${code}: ${message}`);
  }
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  const nodeEnv = parsed.data.NODE_ENV;
  const appEnv = parsed.data.APP_ENV ?? (nodeEnv === "production" ? "prod" : "dev");
  const authProvider = parsed.data.AUTH_PROVIDER ?? (appEnv === "prod" ? "cognito" : "keycloak");
  if (nodeEnv === "production" && appEnv !== "prod") {
    throw new Error("CONFIG_ENV_MISMATCH: NODE_ENV=production requires APP_ENV=prod");
  }

  const derivedIssuerUrl =
    parsed.data.OIDC_ISSUER_URL ??
    (authProvider === "cognito" && parsed.data.COGNITO_REGION && parsed.data.COGNITO_USER_POOL_ID
      ? `https://cognito-idp.${parsed.data.COGNITO_REGION}.amazonaws.com/${parsed.data.COGNITO_USER_POOL_ID}`
      : undefined);

  const cfg: AppConfig = {
    ...parsed.data,
    APP_ENV: appEnv,
    AUTH_PROVIDER: authProvider,
    OIDC_ISSUER_URL: derivedIssuerUrl,
    OIDC_AUDIENCE: parsed.data.OIDC_AUDIENCE ?? (authProvider === "cognito" ? parsed.data.COGNITO_CLIENT_ID : undefined),
    OIDC_PUBLIC_ISSUER_URL: parsed.data.OIDC_PUBLIC_ISSUER_URL ?? derivedIssuerUrl
  };

  if (cfg.APP_ENV === "prod") {
    if (cfg.AUTH_PROVIDER !== "cognito") {
      throw new Error("CONFIG_AUTH_PROVIDER_INSECURE: APP_ENV=prod requires AUTH_PROVIDER=cognito");
    }
    if (cfg.AUTH_SESSION_SECURE_COOKIE !== true) {
      throw new Error(
        "CONFIG_AUTH_COOKIE_INSECURE: APP_ENV=prod requires AUTH_SESSION_SECURE_COOKIE=true"
      );
    }
    requireConfigValue(
      cfg.CORS_ALLOWED_ORIGINS,
      "CONFIG_CORS_INVALID",
      "CORS_ALLOWED_ORIGINS must include at least one explicit origin in prod",
      true
    );
    if (cfg.CORS_ALLOWED_ORIGINS.trim() === "*") {
      throw new Error("CONFIG_CORS_INSECURE: CORS_ALLOWED_ORIGINS cannot be '*' in APP_ENV=prod");
    }
    if (cfg.AUTH_SESSION_STORE !== "redis") {
      throw new Error("CONFIG_SESSION_STORE_INSECURE: APP_ENV=prod requires AUTH_SESSION_STORE=redis");
    }
    requireConfigValue(
      cfg.REDIS_URL,
      "CONFIG_REDIS_MISSING",
      "REDIS_URL must be configured when APP_ENV=prod",
      true
    );
    requireConfigValue(
      cfg.AUTH_SESSION_ENCRYPTION_KEY,
      "CONFIG_SESSION_ENCRYPTION_KEY_MISSING",
      "AUTH_SESSION_ENCRYPTION_KEY must be configured when APP_ENV=prod",
      cfg.AUTH_SESSION_STORE === "redis"
    );
    if (cfg.DATABASE_TLS_INSECURE === true) {
      throw new Error(
        "CONFIG_DATABASE_TLS_INSECURE: DATABASE_TLS_INSECURE cannot be true when APP_ENV=prod"
      );
    }
  }

  if (cfg.AUTH_PROVIDER === "cognito") {
    requireConfigValue(
      cfg.COGNITO_REGION,
      "CONFIG_COGNITO_REGION_MISSING",
      "COGNITO_REGION is required when AUTH_PROVIDER=cognito",
      true
    );
    requireConfigValue(
      cfg.COGNITO_USER_POOL_ID,
      "CONFIG_COGNITO_USER_POOL_ID_MISSING",
      "COGNITO_USER_POOL_ID is required when AUTH_PROVIDER=cognito",
      true
    );
    requireConfigValue(
      cfg.COGNITO_CLIENT_ID,
      "CONFIG_COGNITO_CLIENT_ID_MISSING",
      "COGNITO_CLIENT_ID is required when AUTH_PROVIDER=cognito",
      true
    );
  }

  return cfg;
}

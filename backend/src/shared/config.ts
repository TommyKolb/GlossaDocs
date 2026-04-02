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

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
  /** Base64-encoded 32-byte key for document title/content encryption at rest. Optional. */
  DOCUMENT_ENCRYPTION_KEY: z.string().optional(),
  /**
   * Max JSON request body size in bytes (Fastify `bodyLimit`).
   * Inline images are stored as data URLs in document HTML; the default 1 MiB limit is too small.
   */
  API_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024)
});

export type AppConfig = z.infer<typeof configSchema>;

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  return parsed.data;
}

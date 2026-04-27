import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";

import { registerErrorHandler } from "./modules/api-edge/error-handler.js";
import type { AppConfig } from "./shared/config.js";
import { healthRoutes } from "./modules/api-edge/health-routes.js";
import { createRequestContext } from "./shared/request-context.js";
import { CognitoEmailEnrichingTokenVerifier } from "./modules/identity-access/cognito-email-enriching-token-verifier.js";
import { JoseTokenVerifier } from "./modules/identity-access/jose-token-verifier.js";
import { meRoutes } from "./modules/identity-access/me-routes.js";
import type { TokenVerifier } from "./modules/identity-access/token-verifier.js";
import { authPublicRoutes } from "./modules/identity-access/auth-public-routes.js";
import {
  HttpKeycloakAdminClient,
  requireKeycloakAdminConfig
} from "./modules/identity-access/keycloak-admin-client.js";
import { authRegisterRoutes } from "./modules/identity-access/auth-register-routes.js";
import { authPasswordResetRoutes } from "./modules/identity-access/auth-password-reset-routes.js";
import { authSessionRoutes } from "./modules/identity-access/auth-session-routes.js";
import { ApiError } from "./shared/api-error.js";
import { parseDocumentEncryptionKey } from "./shared/document-encryption.js";
import { DocumentService } from "./modules/documents/document-service.js";
import { PgDocumentRepository } from "./modules/documents/pg-document-repository.js";
import { documentRoutes } from "./modules/documents/document-routes.js";
import { PgSettingsRepository } from "./modules/input-preferences/pg-settings-repository.js";
import { settingsRoutes } from "./modules/input-preferences/settings-routes.js";
import { SettingsService } from "./modules/input-preferences/settings-service.js";
import { registerAuditHook } from "./modules/operational-store/audit-hook.js";
import { NoopAuditWriter, type AuditWriter } from "./modules/operational-store/audit-writer.js";
import { PgAuditWriter } from "./modules/operational-store/pg-audit-writer.js";
import {
  InMemoryAuthSessionStore,
  type AuthSessionStore
} from "./modules/identity-access/auth-session-store.js";
import { RedisAuthSessionStore } from "./modules/identity-access/redis-auth-session-store.js";
import {
  HttpKeycloakOidcClient,
  requireKeycloakOidcClientConfig
} from "./modules/identity-access/keycloak-oidc-client.js";
import {
  HttpCognitoOidcClient,
  requireCognitoOidcClientConfig
} from "./modules/identity-access/cognito-oidc-client.js";
import {
  HttpCognitoAdminClient,
  requireCognitoAdminConfig
} from "./modules/identity-access/cognito-admin-client.js";
import type {
  AuthAdminClient,
  AuthPasswordLoginClient
} from "./modules/identity-access/auth-provider-clients.js";

interface BuildAppOptions {
  tokenVerifier?: TokenVerifier;
  documentService?: DocumentService;
  settingsService?: SettingsService;
  auditWriter?: AuditWriter;
  authAdminClient?: AuthAdminClient | null;
  keycloakAdminClient?: AuthAdminClient | null;
  authSessionStore?: AuthSessionStore;
  passwordLoginClient?: AuthPasswordLoginClient | null;
  keycloakOidcClient?: AuthPasswordLoginClient | null;
}

export type BuildAppConfig = Pick<AppConfig, "NODE_ENV" | "API_PORT" | "CORS_ALLOWED_ORIGINS"> &
  Partial<AppConfig>;

function isProductionPosture(config: BuildAppConfig): boolean {
  if (config.APP_ENV) {
    return config.APP_ENV === "prod";
  }
  return config.NODE_ENV === "production";
}

export function resolveDefaultJwksUrl(config: BuildAppConfig, issuerUrl: string): string {
  if (config.AUTH_PROVIDER === "cognito") {
    return `${issuerUrl.replace(/\/+$/, "")}/.well-known/jwks.json`;
  }
  return `${issuerUrl.replace(/\/+$/, "")}/protocol/openid-connect/certs`;
}

function resolveTokenVerifier(config: BuildAppConfig, injected?: TokenVerifier): TokenVerifier {
  if (injected) {
    return injected;
  }

  if (!config.OIDC_ISSUER_URL) {
    throw new ApiError(
      500,
      "CONFIG_OIDC_INCOMPLETE",
      "OIDC_ISSUER_URL must be configured when no test token verifier is injected"
    );
  }

  const jwksUrl = config.OIDC_JWKS_URL ?? resolveDefaultJwksUrl(config, config.OIDC_ISSUER_URL);
  const authProvider = config.AUTH_PROVIDER ?? "keycloak";
  if (authProvider === "cognito") {
    const cognitoClientId = config.COGNITO_CLIENT_ID ?? config.OIDC_AUDIENCE;
    if (!cognitoClientId) {
      throw new ApiError(
        500,
        "CONFIG_COGNITO_INCOMPLETE",
        "COGNITO_CLIENT_ID (or OIDC_AUDIENCE) must be configured when AUTH_PROVIDER=cognito"
      );
    }
    return new JoseTokenVerifier({
      issuerUrl: config.OIDC_ISSUER_URL,
      jwksUrl,
      cognitoClientId,
      expectedTokenUse: "access"
    });
  }

  if (!config.OIDC_AUDIENCE) {
    throw new ApiError(
      500,
      "CONFIG_OIDC_INCOMPLETE",
      "OIDC_AUDIENCE must be configured when AUTH_PROVIDER=keycloak"
    );
  }

  return new JoseTokenVerifier({
    issuerUrl: config.OIDC_ISSUER_URL,
    audience: config.OIDC_AUDIENCE,
    jwksUrl
  });
}

function wrapTokenVerifierWithCognitoEmailEnrichment(
  config: BuildAppConfig,
  verifier: TokenVerifier,
  injectedVerifier?: TokenVerifier,
  logger?: Pick<FastifyInstance["log"], "warn">
): TokenVerifier {
  if (injectedVerifier) {
    return verifier;
  }
  const authProvider = config.AUTH_PROVIDER ?? "keycloak";
  if (authProvider !== "cognito" || !config.COGNITO_REGION) {
    return verifier;
  }
  const cognitoClient = new CognitoIdentityProviderClient({ region: config.COGNITO_REGION });
  return new CognitoEmailEnrichingTokenVerifier(verifier, cognitoClient, logger);
}

function resolveCorsOrigin(config: BuildAppConfig): true | string[] {
  const configuredOrigins = config.CORS_ALLOWED_ORIGINS.trim();
  const isWildcard = configuredOrigins === "*";

  if (isWildcard && isProductionPosture(config)) {
    throw new ApiError(
      500,
      "CONFIG_CORS_INSECURE",
      "CORS_ALLOWED_ORIGINS cannot be '*' in production when credentials are enabled"
    );
  }

  if (isWildcard) {
    return true;
  }

  const origins = configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new ApiError(500, "CONFIG_CORS_INVALID", "CORS_ALLOWED_ORIGINS must include at least one origin");
  }

  return origins;
}

function resolveAuthSessionStore(config: BuildAppConfig, injected?: AuthSessionStore): AuthSessionStore {
  if (injected) {
    return injected;
  }

  const selectedStore = config.AUTH_SESSION_STORE ?? "memory";
  if (selectedStore === "redis") {
    if (!config.REDIS_URL) {
      throw new ApiError(
        500,
        "CONFIG_REDIS_MISSING",
        "REDIS_URL must be configured when AUTH_SESSION_STORE=redis"
      );
    }

    return new RedisAuthSessionStore({
      redisUrl: config.REDIS_URL,
      keyPrefix: config.AUTH_REDIS_KEY_PREFIX,
      encryptionKey: config.AUTH_SESSION_ENCRYPTION_KEY
    });
  }

  if (selectedStore === "memory" && isProductionPosture(config)) {
    throw new ApiError(
      500,
      "CONFIG_SESSION_STORE_INSECURE",
      "AUTH_SESSION_STORE=memory is not allowed in production; use AUTH_SESSION_STORE=redis"
    );
  }

  return new InMemoryAuthSessionStore();
}

const DEFAULT_BODY_LIMIT_BYTES = 15 * 1024 * 1024;

export function buildApp(config: BuildAppConfig, options: BuildAppOptions = {}): FastifyInstance {
  const bodyLimit = config.API_BODY_LIMIT_BYTES ?? DEFAULT_BODY_LIMIT_BYTES;
  const app = Fastify({
    logger: config.NODE_ENV !== "test",
    bodyLimit,
    trustProxy: config.API_TRUST_PROXY === true
  });

  app.decorateRequest("requestContext", null);
  app.decorateRequest("principal", null);

  app.addHook("onRequest", async (request) => {
    request.requestContext = createRequestContext(request);
    request.principal = null;
  });

  void app.register(cors, {
    origin: resolveCorsOrigin(config),
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true
  });
  void app.register(cookie);

  registerErrorHandler(app);

  const tokenVerifier = wrapTokenVerifierWithCognitoEmailEnrichment(
    config,
    resolveTokenVerifier(config, options.tokenVerifier),
    options.tokenVerifier,
    app.log
  );
  const databaseUrl = config.DATABASE_URL;
  if (!databaseUrl && (!options.documentService || !options.settingsService)) {
    throw new ApiError(
      500,
      "CONFIG_DATABASE_MISSING",
      "DATABASE_URL must be configured when no test services are injected"
    );
  }

  const documentEncryptionKey = parseDocumentEncryptionKey(config.DOCUMENT_ENCRYPTION_KEY);
  const documentService =
    options.documentService ??
    new DocumentService(
      new PgDocumentRepository({
        databaseUrl: databaseUrl as string,
        encryptionKey: documentEncryptionKey
      })
    );
  const settingsService =
    options.settingsService ?? new SettingsService(new PgSettingsRepository(databaseUrl as string));
  const auditWriter =
    options.auditWriter ??
    (databaseUrl ? new PgAuditWriter(databaseUrl) : new NoopAuditWriter());

  const authProvider = config.AUTH_PROVIDER ?? "keycloak";
  const authAdminClient: AuthAdminClient | null =
    options.authAdminClient ??
    options.keycloakAdminClient ??
    (authProvider === "cognito"
      ? config.COGNITO_REGION && config.COGNITO_USER_POOL_ID && config.COGNITO_CLIENT_ID
        ? new HttpCognitoAdminClient(
            requireCognitoAdminConfig({
              region: config.COGNITO_REGION,
              userPoolId: config.COGNITO_USER_POOL_ID,
              clientId: config.COGNITO_CLIENT_ID,
              clientSecret: config.COGNITO_CLIENT_SECRET
            })
          )
        : null
      : config.KEYCLOAK_ADMIN_URL &&
          config.KEYCLOAK_REALM &&
          config.KEYCLOAK_ADMIN_USERNAME &&
          config.KEYCLOAK_ADMIN_PASSWORD
        ? new HttpKeycloakAdminClient(
            requireKeycloakAdminConfig({
              adminUrl: config.KEYCLOAK_ADMIN_URL,
              realm: config.KEYCLOAK_REALM,
              adminUsername: config.KEYCLOAK_ADMIN_USERNAME,
              adminPassword: config.KEYCLOAK_ADMIN_PASSWORD,
              executeActionsClientId: config.KEYCLOAK_CLIENT_ID ?? config.OIDC_PUBLIC_CLIENT_ID,
              executeActionsRedirectUri: config.OIDC_PUBLIC_REDIRECT_URI
            })
          )
        : null);
  const passwordLoginClient: AuthPasswordLoginClient | null =
    options.passwordLoginClient ??
    options.keycloakOidcClient ??
    (authProvider === "cognito"
      ? config.COGNITO_REGION && config.COGNITO_CLIENT_ID
        ? new HttpCognitoOidcClient(
            requireCognitoOidcClientConfig({
              region: config.COGNITO_REGION,
              clientId: config.COGNITO_CLIENT_ID,
              clientSecret: config.COGNITO_CLIENT_SECRET
            })
          )
        : null
      : config.KEYCLOAK_TOKEN_URL && config.KEYCLOAK_CLIENT_ID
        ? new HttpKeycloakOidcClient(
            requireKeycloakOidcClientConfig({
              tokenUrl: config.KEYCLOAK_TOKEN_URL,
              clientId: config.KEYCLOAK_CLIENT_ID,
              clientSecret: config.KEYCLOAK_CLIENT_SECRET
            })
          )
        : null);
  const authSessionStore = resolveAuthSessionStore(config, options.authSessionStore);

  app.decorate("authSessionStore", authSessionStore);
  app.decorate("authSessionCookieName", config.AUTH_SESSION_COOKIE_NAME ?? "glossadocs_session");

  void app.register(healthRoutes, { databaseUrl });
  void app.register(authPublicRoutes, { config });
  void app.register(authSessionRoutes, {
    config: {
      AUTH_SESSION_COOKIE_NAME: config.AUTH_SESSION_COOKIE_NAME ?? "glossadocs_session",
      AUTH_SESSION_TTL_SECONDS: config.AUTH_SESSION_TTL_SECONDS ?? 3600,
      AUTH_SESSION_SECURE_COOKIE: config.AUTH_SESSION_SECURE_COOKIE ?? false
    },
    loginRateLimitWindowMs: config.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS ?? 60_000,
    loginRateLimitMaxAttempts: config.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? 20,
    tokenVerifier,
    authSessionStore,
    passwordLoginClient
  });
  void app.register(authRegisterRoutes, {
    authAdminClient,
    registerRateLimitWindowMs: config.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS ?? 60_000,
    registerRateLimitMaxAttempts: config.AUTH_REGISTER_RATE_LIMIT_MAX_ATTEMPTS ?? 20
  });
  void app.register(authPasswordResetRoutes, {
    authAdminClient,
    authProvider,
    resetRateLimitWindowMs: config.AUTH_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS ?? 60_000,
    resetRateLimitMaxAttempts: config.AUTH_PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS ?? 20
  });
  void app.register(meRoutes, { tokenVerifier });
  void app.register(documentRoutes, { tokenVerifier, service: documentService });
  void app.register(settingsRoutes, { tokenVerifier, service: settingsService });
  registerAuditHook(app, auditWriter);
  app.addHook("onClose", async () => {
    if (typeof authSessionStore.close === "function") {
      await authSessionStore.close();
    }
  });

  return app;
}

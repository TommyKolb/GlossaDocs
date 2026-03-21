import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";

import { registerErrorHandler } from "./modules/api-edge/error-handler.js";
import type { AppConfig } from "./shared/config.js";
import { healthRoutes } from "./modules/api-edge/health-routes.js";
import { createRequestContext } from "./shared/request-context.js";
import { JoseTokenVerifier } from "./modules/identity-access/jose-token-verifier.js";
import { meRoutes } from "./modules/identity-access/me-routes.js";
import type { TokenVerifier } from "./modules/identity-access/token-verifier.js";
import { authPublicRoutes } from "./modules/identity-access/auth-public-routes.js";
import type { KeycloakAdminClient } from "./modules/identity-access/keycloak-admin-client.js";
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
import type { KeycloakOidcClient } from "./modules/identity-access/keycloak-oidc-client.js";
import {
  HttpKeycloakOidcClient,
  requireKeycloakOidcClientConfig
} from "./modules/identity-access/keycloak-oidc-client.js";

interface BuildAppOptions {
  tokenVerifier?: TokenVerifier;
  documentService?: DocumentService;
  settingsService?: SettingsService;
  auditWriter?: AuditWriter;
  keycloakAdminClient?: KeycloakAdminClient;
  authSessionStore?: AuthSessionStore;
  keycloakOidcClient?: KeycloakOidcClient;
}

type BuildAppConfig = Pick<AppConfig, "NODE_ENV" | "API_PORT" | "CORS_ALLOWED_ORIGINS"> &
  Partial<AppConfig>;

function resolveTokenVerifier(config: BuildAppConfig, injected?: TokenVerifier): TokenVerifier {
  if (injected) {
    return injected;
  }

  if (!config.OIDC_ISSUER_URL || !config.OIDC_AUDIENCE) {
    throw new ApiError(
      500,
      "CONFIG_OIDC_INCOMPLETE",
      "OIDC_ISSUER_URL and OIDC_AUDIENCE must be configured when no test token verifier is injected"
    );
  }

  const jwksUrl = config.OIDC_JWKS_URL ?? `${config.OIDC_ISSUER_URL}/protocol/openid-connect/certs`;
  return new JoseTokenVerifier({
    issuerUrl: config.OIDC_ISSUER_URL,
    audience: config.OIDC_AUDIENCE,
    jwksUrl
  });
}

export function buildApp(config: BuildAppConfig, options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: config.NODE_ENV !== "test"
  });

  app.decorateRequest("requestContext", null);
  app.decorateRequest("principal", null);

  app.addHook("onRequest", async (request) => {
    request.requestContext = createRequestContext(request);
    request.principal = null;
  });

  void app.register(cors, {
    origin: config.CORS_ALLOWED_ORIGINS === "*" ? true : config.CORS_ALLOWED_ORIGINS,
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true
  });
  void app.register(cookie);

  registerErrorHandler(app);

  const tokenVerifier = resolveTokenVerifier(config, options.tokenVerifier);
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

  const keycloakAdminClient: KeycloakAdminClient | null =
    options.keycloakAdminClient ??
    (config.KEYCLOAK_ADMIN_URL &&
    config.KEYCLOAK_REALM &&
    config.KEYCLOAK_ADMIN_USERNAME &&
    config.KEYCLOAK_ADMIN_PASSWORD
      ? new HttpKeycloakAdminClient(
          requireKeycloakAdminConfig({
            adminUrl: config.KEYCLOAK_ADMIN_URL,
            realm: config.KEYCLOAK_REALM,
            adminUsername: config.KEYCLOAK_ADMIN_USERNAME,
            adminPassword: config.KEYCLOAK_ADMIN_PASSWORD
          })
        )
      : null);
  const keycloakOidcClient: KeycloakOidcClient | null =
    options.keycloakOidcClient ??
    (config.KEYCLOAK_TOKEN_URL && config.KEYCLOAK_CLIENT_ID
      ? new HttpKeycloakOidcClient(
          requireKeycloakOidcClientConfig({
            tokenUrl: config.KEYCLOAK_TOKEN_URL,
            clientId: config.KEYCLOAK_CLIENT_ID,
            clientSecret: config.KEYCLOAK_CLIENT_SECRET
          })
        )
      : null);
  const authSessionStore = options.authSessionStore ?? new InMemoryAuthSessionStore();

  app.decorate("authSessionStore", authSessionStore);
  app.decorate("authSessionCookieName", config.AUTH_SESSION_COOKIE_NAME ?? "glossadocs_session");

  void app.register(healthRoutes);
  void app.register(authPublicRoutes, { config });
  void app.register(authSessionRoutes, {
    config: {
      ...config,
      AUTH_SESSION_COOKIE_NAME: config.AUTH_SESSION_COOKIE_NAME ?? "glossadocs_session",
      AUTH_SESSION_TTL_SECONDS: config.AUTH_SESSION_TTL_SECONDS ?? 3600,
      AUTH_SESSION_SECURE_COOKIE: config.AUTH_SESSION_SECURE_COOKIE ?? false
    },
    tokenVerifier,
    authSessionStore,
    keycloakOidcClient
  });
  void app.register(authRegisterRoutes, { keycloakAdminClient });
  void app.register(authPasswordResetRoutes, { keycloakAdminClient });
  void app.register(meRoutes, { tokenVerifier });
  void app.register(documentRoutes, { tokenVerifier, service: documentService });
  void app.register(settingsRoutes, { tokenVerifier, service: settingsService });
  registerAuditHook(app, auditWriter);

  return app;
}

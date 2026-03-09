import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import { registerErrorHandler } from "./modules/api-edge/error-handler.js";
import type { AppConfig } from "./shared/config.js";
import { healthRoutes } from "./modules/api-edge/health-routes.js";
import { createRequestContext } from "./shared/request-context.js";
import { JoseTokenVerifier } from "./modules/identity-access/jose-token-verifier.js";
import { meRoutes } from "./modules/identity-access/me-routes.js";
import type { TokenVerifier } from "./modules/identity-access/token-verifier.js";
import { ApiError } from "./shared/api-error.js";
import { DocumentService } from "./modules/documents/document-service.js";
import { PgDocumentRepository } from "./modules/documents/pg-document-repository.js";
import { documentRoutes } from "./modules/documents/document-routes.js";
import { PgSettingsRepository } from "./modules/input-preferences/pg-settings-repository.js";
import { settingsRoutes } from "./modules/input-preferences/settings-routes.js";
import { SettingsService } from "./modules/input-preferences/settings-service.js";
import { registerAuditHook } from "./modules/operational-store/audit-hook.js";
import { NoopAuditWriter, type AuditWriter } from "./modules/operational-store/audit-writer.js";
import { PgAuditWriter } from "./modules/operational-store/pg-audit-writer.js";

interface BuildAppOptions {
  tokenVerifier?: TokenVerifier;
  documentService?: DocumentService;
  settingsService?: SettingsService;
  auditWriter?: AuditWriter;
}

function resolveTokenVerifier(config: AppConfig, injected?: TokenVerifier): TokenVerifier {
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

export function buildApp(config: AppConfig, options: BuildAppOptions = {}): FastifyInstance {
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
    origin: config.CORS_ALLOWED_ORIGINS === "*" ? true : config.CORS_ALLOWED_ORIGINS
  });

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

  const documentService =
    options.documentService ?? new DocumentService(new PgDocumentRepository(databaseUrl as string));
  const settingsService =
    options.settingsService ?? new SettingsService(new PgSettingsRepository(databaseUrl as string));
  const auditWriter =
    options.auditWriter ??
    (databaseUrl ? new PgAuditWriter(databaseUrl) : new NoopAuditWriter());

  void app.register(healthRoutes);
  void app.register(meRoutes, { tokenVerifier });
  void app.register(documentRoutes, { tokenVerifier, service: documentService });
  void app.register(settingsRoutes, { tokenVerifier, service: settingsService });
  registerAuditHook(app, auditWriter);

  return app;
}

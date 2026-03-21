import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { ApiError } from "../../shared/api-error.js";
import type { AppConfig } from "../../shared/config.js";
import type { AuthSessionStore } from "./auth-session-store.js";
import type { KeycloakOidcClient } from "./keycloak-oidc-client.js";
import { KeycloakOidcClientError } from "./keycloak-oidc-client.js";
import type { TokenVerifier } from "./token-verifier.js";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

interface AuthSessionRoutesOptions {
  config: Pick<
    AppConfig,
    "AUTH_SESSION_COOKIE_NAME" | "AUTH_SESSION_TTL_SECONDS" | "AUTH_SESSION_SECURE_COOKIE"
  >;
  tokenVerifier: TokenVerifier;
  authSessionStore: AuthSessionStore;
  keycloakOidcClient: KeycloakOidcClient | null;
}

function getCookieOptions(
  config: Pick<
    AppConfig,
    "AUTH_SESSION_COOKIE_NAME" | "AUTH_SESSION_TTL_SECONDS" | "AUTH_SESSION_SECURE_COOKIE"
  >
): {
  cookieName: string;
  maxAgeSeconds: number;
  secure: boolean;
} {
  return {
    cookieName: config.AUTH_SESSION_COOKIE_NAME,
    maxAgeSeconds: config.AUTH_SESSION_TTL_SECONDS,
    secure: config.AUTH_SESSION_SECURE_COOKIE
  };
}

export const authSessionRoutes: FastifyPluginAsync<AuthSessionRoutesOptions> = async (app, options) => {
  app.post("/auth/login", async (request, reply) => {
    if (!options.keycloakOidcClient) {
      throw new ApiError(500, "CONFIG_KEYCLOAK_OIDC_INCOMPLETE", "Keycloak login is not configured");
    }

    const { username, password } = loginSchema.parse(request.body);
    const { cookieName, maxAgeSeconds, secure } = getCookieOptions(options.config);

    try {
      const login = await options.keycloakOidcClient.loginWithPassword({ username, password });
      const principal = await options.tokenVerifier.verify(login.accessToken);
      const sessionTtlSeconds = Math.max(1, Math.min(maxAgeSeconds, login.expiresInSeconds));
      const session = await options.authSessionStore.create({
        accessToken: login.accessToken,
        ttlSeconds: sessionTtlSeconds
      });

      reply.setCookie(cookieName, session.id, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure,
        maxAge: sessionTtlSeconds
      });

      return reply.status(200).send({
        user: {
          sub: principal.actorSub,
          username: principal.username,
          email: principal.email
        }
      });
    } catch (error) {
      if (
        error instanceof KeycloakOidcClientError &&
        error.code === "KEYCLOAK_OIDC_INVALID_CREDENTIALS"
      ) {
        throw new ApiError(401, "AUTH_INVALID_CREDENTIALS", "Invalid username or password");
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(502, "AUTH_IDP_UNAVAILABLE", "Unable to complete login");
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    const { cookieName, secure } = getCookieOptions(options.config);
    const sessionId = request.cookies[cookieName];
    if (sessionId) {
      await options.authSessionStore.delete(sessionId);
    }
    reply.clearCookie(cookieName, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure
    });
    return reply.status(204).send();
  });

  app.get(
    "/auth/session",
    {
      preHandler: async (request, reply) => {
        const sessionId = request.cookies[options.config.AUTH_SESSION_COOKIE_NAME];
        if (!sessionId) {
          throw new ApiError(401, "AUTH_MISSING_SESSION", "No active session");
        }

        const session = await options.authSessionStore.get(sessionId);
        if (!session) {
          throw new ApiError(401, "AUTH_INVALID_SESSION", "Session is missing or expired");
        }

        const principal = await options.tokenVerifier.verify(session.accessToken);
        request.principal = principal;
      }
    },
    async (request) => {
      if (!request.principal) {
        throw new ApiError(401, "AUTH_MISSING_PRINCIPAL", "Authenticated principal was not resolved");
      }

      return {
        user: {
          sub: request.principal.actorSub,
          username: request.principal.username,
          email: request.principal.email
        }
      };
    }
  );
};

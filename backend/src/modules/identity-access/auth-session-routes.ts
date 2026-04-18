import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { ApiError } from "../../shared/api-error.js";
import type { AppConfig } from "../../shared/config.js";
import { getAuthProviderErrorCode } from "./auth-provider-errors.js";
import type { AuthSessionStore } from "./auth-session-store.js";
import type { AuthPasswordLoginClient } from "./auth-provider-clients.js";
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
  passwordLoginClient: AuthPasswordLoginClient | null;
  loginRateLimitWindowMs?: number;
  loginRateLimitMaxAttempts?: number;
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
  sameSite: "lax" | "none";
} {
  const secure = config.AUTH_SESSION_SECURE_COOKIE;
  return {
    cookieName: config.AUTH_SESSION_COOKIE_NAME,
    maxAgeSeconds: config.AUTH_SESSION_TTL_SECONDS,
    secure,
    sameSite: secure ? "none" : "lax"
  };
}

export const authSessionRoutes: FastifyPluginAsync<AuthSessionRoutesOptions> = async (app, options) => {
  const loginAttemptsByKey = new Map<string, number[]>();
  const loginRateLimitWindowMs = options.loginRateLimitWindowMs ?? 60_000;
  const loginRateLimitMaxAttempts = options.loginRateLimitMaxAttempts ?? 20;

  function enforceLoginRateLimit(request: FastifyRequest): void {
    const key = request.ip || "unknown-ip";
    const now = Date.now();
    const cutoff = now - loginRateLimitWindowMs;
    const recentAttempts = (loginAttemptsByKey.get(key) ?? []).filter((value) => value >= cutoff);

    if (recentAttempts.length >= loginRateLimitMaxAttempts) {
      loginAttemptsByKey.set(key, recentAttempts);
      throw new ApiError(
        429,
        "AUTH_RATE_LIMITED",
        "Too many login attempts. Please wait before trying again."
      );
    }

    recentAttempts.push(now);
    loginAttemptsByKey.set(key, recentAttempts);
  }

  app.get("/auth/login", async (_request, reply) =>
    reply
      .status(405)
      .header("Allow", "POST")
      .send({
        message:
          "Use POST /auth/login with JSON body { username, password }. Login is not available via GET (for example opening this URL in a browser)."
      })
  );

  app.post("/auth/login", async (request, reply) => {
    enforceLoginRateLimit(request);

    if (!options.passwordLoginClient) {
      throw new ApiError(500, "CONFIG_AUTH_LOGIN_INCOMPLETE", "Auth login provider is not configured");
    }

    const { username, password } = loginSchema.parse(request.body);
    const { cookieName, maxAgeSeconds, secure, sameSite } = getCookieOptions(options.config);

    try {
      const login = await options.passwordLoginClient.loginWithPassword({ username, password });
      const principal = await options.tokenVerifier.verify(login.accessToken);
      const sessionTtlSeconds = Math.max(1, Math.min(maxAgeSeconds, login.expiresInSeconds));
      const session = await options.authSessionStore.create({
        accessToken: login.accessToken,
        ttlSeconds: sessionTtlSeconds
      });

      reply.setCookie(cookieName, session.id, {
        path: "/",
        httpOnly: true,
        sameSite,
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
      const errorCode = getAuthProviderErrorCode(error);
      if (
        errorCode === "KEYCLOAK_OIDC_INVALID_CREDENTIALS" ||
        errorCode === "COGNITO_OIDC_INVALID_CREDENTIALS"
      ) {
        throw new ApiError(401, "AUTH_INVALID_CREDENTIALS", "Invalid username or password");
      }
      if (errorCode === "COGNITO_OIDC_EMAIL_NOT_VERIFIED") {
        throw new ApiError(
          403,
          "AUTH_EMAIL_NOT_VERIFIED",
          "This account is not confirmed yet. If you registered before email-free sign-up was enabled, create a new account or ask an admin to confirm your user in Cognito."
        );
      }
      if (errorCode === "COGNITO_OIDC_AUTH_CHALLENGE") {
        throw new ApiError(
          400,
          "AUTH_CHALLENGE_UNSUPPORTED",
          error instanceof Error ? error.message : "Additional login step is not supported."
        );
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(502, "AUTH_IDP_UNAVAILABLE", "Unable to complete login");
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    const { cookieName, secure, sameSite } = getCookieOptions(options.config);
    const sessionId = request.cookies[cookieName];
    try {
      if (sessionId) {
        await options.authSessionStore.delete(sessionId);
      }
    } catch (error) {
      request.log.warn({ error }, "Failed to delete auth session during logout");
    } finally {
      reply.clearCookie(cookieName, {
        path: "/",
        httpOnly: true,
        sameSite,
        secure
      });
    }
    return reply.status(204).send();
  });

  app.get(
    "/auth/session",
    {
      preHandler: async (request, reply) => {
        const { cookieName } = getCookieOptions(options.config);
        const sessionId = request.cookies[cookieName];
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

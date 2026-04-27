import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { createInMemorySlidingWindowIpRateLimiter } from "../api-edge/in-memory-sliding-window-rate-limit.js";
import { ApiError } from "../../shared/api-error.js";
import { cognitoRegisterPasswordSchema } from "../../shared/cognito-password-policy.js";
import { getAuthProviderErrorCode } from "./auth-provider-errors.js";
import type { AuthAdminClient } from "./auth-provider-clients.js";

const registerSchema = z.object({
  email: z.email(),
  password: cognitoRegisterPasswordSchema
});

interface AuthRegisterRoutesOptions {
  authAdminClient: Pick<AuthAdminClient, "createUser"> | null;
  registerRateLimitWindowMs?: number;
  registerRateLimitMaxAttempts?: number;
}

export const authRegisterRoutes: FastifyPluginAsync<AuthRegisterRoutesOptions> = async (app, options) => {
  const registerRateLimitWindowMs = options.registerRateLimitWindowMs ?? 60_000;
  const registerRateLimitMaxAttempts = options.registerRateLimitMaxAttempts ?? 20;
  const registerRateLimit = createInMemorySlidingWindowIpRateLimiter({
    windowMs: registerRateLimitWindowMs,
    maxAttempts: registerRateLimitMaxAttempts,
    tooManyMessage: "Too many sign-up attempts. Please wait before trying again."
  });
  app.get("/auth/register", async (_request, reply) =>
    reply
      .status(405)
      .header("Allow", "POST")
      .send({
        message:
          "Use POST /auth/register with JSON body { email, password }. Sign-up is not available via GET (for example opening this URL in a browser)."
      })
  );

  app.post("/auth/register", async (request, reply) => {
    registerRateLimit.enforce(request.ip);

    if (!options.authAdminClient) {
      throw new ApiError(500, "CONFIG_AUTH_ADMIN_INCOMPLETE", "Auth admin provider is not configured");
    }

    const { email, password } = registerSchema.parse(request.body);

    try {
      await options.authAdminClient.createUser({ email, password });
      return reply.status(201).send({ message: "Account created." });
    } catch (err) {
      const errorCode = getAuthProviderErrorCode(err);
      if (errorCode === "KEYCLOAK_USER_EXISTS" || errorCode === "COGNITO_USER_EXISTS") {
        throw new ApiError(409, "AUTH_EMAIL_TAKEN", "Email is already in use");
      }
      if (errorCode === "COGNITO_INVALID_PASSWORD" || errorCode === "COGNITO_INVALID_PARAMETER") {
        const msg = err instanceof Error ? err.message : "Invalid sign-up data";
        throw new ApiError(400, "AUTH_SIGNUP_REJECTED", msg);
      }
      if (errorCode === "COGNITO_CONFIRMATION_FAILED") {
        throw new ApiError(
          502,
          "AUTH_SIGNUP_CONFIRMATION_FAILED",
          "Account creation reached Cognito but final confirmation failed. Please try again."
        );
      }
      throw new ApiError(502, "AUTH_IDP_UNAVAILABLE", "Unable to create account");
    }
  });
};


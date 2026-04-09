import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { ApiError } from "../../shared/api-error.js";
import { getAuthProviderErrorCode } from "./auth-provider-errors.js";
import type { AuthAdminClient } from "./auth-provider-clients.js";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

interface AuthRegisterRoutesOptions {
  authAdminClient: Pick<AuthAdminClient, "createUser"> | null;
}

export const authRegisterRoutes: FastifyPluginAsync<AuthRegisterRoutesOptions> = async (app, options) => {
  app.post("/auth/register", async (request, reply) => {
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
      throw new ApiError(502, "AUTH_IDP_UNAVAILABLE", "Unable to create account");
    }
  });
};


import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { ApiError } from "../../shared/api-error.js";
import type { KeycloakAdminClient } from "./keycloak-admin-client.js";
import { isKeycloakAdminErrorCode } from "./keycloak-admin-client.js";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

interface AuthRegisterRoutesOptions {
  keycloakAdminClient: KeycloakAdminClient | null;
}

export const authRegisterRoutes: FastifyPluginAsync<AuthRegisterRoutesOptions> = async (app, options) => {
  app.post("/auth/register", async (request, reply) => {
    if (!options.keycloakAdminClient) {
      throw new ApiError(500, "CONFIG_KEYCLOAK_ADMIN_INCOMPLETE", "Keycloak admin is not configured");
    }

    const { email, password } = registerSchema.parse(request.body);

    try {
      await options.keycloakAdminClient.createUser({ email, password });
      return reply.status(201).send({ message: "Account created." });
    } catch (err) {
      if (isKeycloakAdminErrorCode(err, "KEYCLOAK_USER_EXISTS")) {
        throw new ApiError(409, "AUTH_EMAIL_TAKEN", "Email is already in use");
      }
      throw new ApiError(502, "AUTH_IDP_UNAVAILABLE", "Unable to create account");
    }
  });
};


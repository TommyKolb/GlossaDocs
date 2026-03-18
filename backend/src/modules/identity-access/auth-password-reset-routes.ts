import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { ApiError } from "../../shared/api-error.js";
import type { KeycloakAdminClient } from "./keycloak-admin-client.js";
import { KeycloakAdminClientError } from "./keycloak-admin-client.js";

const resetSchema = z.object({
  email: z.string().email()
});

interface AuthPasswordResetRoutesOptions {
  keycloakAdminClient: KeycloakAdminClient | null;
}

export const authPasswordResetRoutes: FastifyPluginAsync<AuthPasswordResetRoutesOptions> = async (
  app,
  options
) => {
  app.post("/auth/password-reset", async (request) => {
    if (!options.keycloakAdminClient) {
      throw new ApiError(500, "CONFIG_KEYCLOAK_ADMIN_INCOMPLETE", "Keycloak admin is not configured");
    }

    const { email } = resetSchema.parse(request.body);

    try {
      await options.keycloakAdminClient.sendPasswordResetEmail({ email });
    } catch (err) {
      // Security: do not leak whether a user exists.
      if (err instanceof KeycloakAdminClientError && err.code === "KEYCLOAK_USER_NOT_FOUND") {
        // swallow
      } else if (typeof err === "object" && err && (err as any).code === "KEYCLOAK_USER_NOT_FOUND") {
        // swallow
      } else {
        // treat transient IdP errors as a no-op for privacy; user sees generic success.
      }
    }

    return {
      message: "If an account exists for that email, a reset message has been sent."
    };
  });
};


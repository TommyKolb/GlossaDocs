import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { ApiError } from "../../shared/api-error.js";
import type { AuthAdminClient } from "./auth-provider-clients.js";

const resetSchema = z.object({
  email: z.email()
});

interface AuthPasswordResetRoutesOptions {
  authAdminClient: Pick<AuthAdminClient, "sendPasswordResetEmail"> | null;
}

export const authPasswordResetRoutes: FastifyPluginAsync<AuthPasswordResetRoutesOptions> = async (
  app,
  options
) => {
  app.post("/auth/password-reset", async (request) => {
    if (!options.authAdminClient) {
      throw new ApiError(500, "CONFIG_AUTH_ADMIN_INCOMPLETE", "Auth admin provider is not configured");
    }

    const { email } = resetSchema.parse(request.body);

    try {
      await options.authAdminClient.sendPasswordResetEmail({ email });
    } catch (err) {
      // Security: do not leak whether a user exists.
      const errorCode =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code)
          : null;
      if (errorCode === "KEYCLOAK_USER_NOT_FOUND" || errorCode === "COGNITO_USER_NOT_FOUND") {
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


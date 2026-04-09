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
    } catch {
      // Security: do not leak whether a user exists.
      // Treat all IdP outcomes as no-op for anti-enumeration behavior.
    }

    return {
      message: "If an account exists for that email, a reset message has been sent."
    };
  });
};


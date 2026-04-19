import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { cognitoPasswordSchema } from "../../shared/cognito-password-policy.js";
import { ApiError } from "../../shared/api-error.js";
import { CognitoAdminClientError } from "./cognito-admin-client.js";
import { getAuthProviderErrorCode } from "./auth-provider-errors.js";
import type { AuthAdminClient } from "./auth-provider-clients.js";

const resetSchema = z.object({
  email: z.email()
});

const confirmSchema = z.object({
  email: z.email(),
  code: z.string().trim().min(1),
  newPassword: cognitoPasswordSchema
});

interface AuthPasswordResetRoutesOptions {
  authAdminClient: AuthAdminClient | null;
  authProvider: "keycloak" | "cognito";
}

export const authPasswordResetRoutes: FastifyPluginAsync<AuthPasswordResetRoutesOptions> = async (
  app,
  options
) => {
  app.post("/auth/password-reset", async (request, reply) => {
    if (!options.authAdminClient) {
      throw new ApiError(500, "CONFIG_AUTH_ADMIN_INCOMPLETE", "Auth admin provider is not configured");
    }

    const { email } = resetSchema.parse(request.body);

    try {
      await options.authAdminClient.sendPasswordResetEmail({ email });
    } catch (error) {
      // Security: do not leak whether a user exists.
      // Treat all IdP outcomes as no-op for anti-enumeration behavior.
      request.log.warn(
        { err: error, idp: options.authProvider },
        "Password reset email request did not complete successfully"
      );
    }

    return reply.send({
      message: "If an account exists for that email, a reset message has been sent."
    });
  });

  app.post("/auth/password-reset/confirm", async (request, reply) => {
    if (options.authProvider !== "cognito") {
      return reply.status(501).send({
        code: "AUTH_PASSWORD_RESET_CONFIRM_UNSUPPORTED",
        message:
          "Password reset confirmation is not available for this deployment. Use the link in your reset email."
      });
    }

    if (!options.authAdminClient?.confirmForgotPassword) {
      throw new ApiError(500, "CONFIG_AUTH_ADMIN_INCOMPLETE", "Auth admin provider is not configured");
    }

    const { email, code, newPassword } = confirmSchema.parse(request.body);

    try {
      await options.authAdminClient.confirmForgotPassword({ email, code, newPassword });
    } catch (error) {
      const errorCode = getAuthProviderErrorCode(error);
      const message =
        error instanceof CognitoAdminClientError ? error.message : "Unable to complete password reset";

      if (
        errorCode === "COGNITO_RESET_CODE_INVALID" ||
        errorCode === "COGNITO_RESET_CODE_EXPIRED" ||
        errorCode === "COGNITO_INVALID_PASSWORD" ||
        errorCode === "COGNITO_INVALID_PARAMETER" ||
        errorCode === "COGNITO_USER_NOT_FOUND"
      ) {
        throw new ApiError(400, errorCode ?? "AUTH_PASSWORD_RESET_FAILED", message);
      }
      if (errorCode === "COGNITO_ADMIN_UNAVAILABLE") {
        throw new ApiError(502, errorCode, message);
      }
      throw new ApiError(502, "AUTH_IDP_UNAVAILABLE", message);
    }

    return reply.send({
      message: "Password has been reset. You can sign in with your new password."
    });
  });
};

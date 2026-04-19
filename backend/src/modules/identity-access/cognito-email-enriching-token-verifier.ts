import { CognitoIdentityProviderClient, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

import type { AuthenticatedPrincipal, TokenVerifier } from "./token-verifier.js";

interface LoggerLike {
  warn(meta: Record<string, unknown>, message: string): void;
}

/**
 * Cognito access tokens often omit the `email` claim; `GetUser` with the same access token
 * returns verified attributes including email for display and `/me`.
 */
export class CognitoEmailEnrichingTokenVerifier implements TokenVerifier {
  public constructor(
    private readonly inner: TokenVerifier,
    private readonly cognitoClient: CognitoIdentityProviderClient,
    private readonly logger?: LoggerLike
  ) {}

  public async verify(token: string): Promise<AuthenticatedPrincipal> {
    const principal = await this.inner.verify(token);
    if (principal.email) {
      return principal;
    }

    try {
      const result = await this.cognitoClient.send(new GetUserCommand({ AccessToken: token }));
      const email = result.UserAttributes?.find((a) => a.Name === "email")?.Value?.trim();
      if (email) {
        return {
          ...principal,
          email
        };
      }
    } catch (error) {
      // JWT verification already succeeded; enrichment is best-effort only.
      const errorName =
        typeof error === "object" && error !== null && "name" in error ? (error as { name?: unknown }).name : undefined;
      const errorCode =
        typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
      this.logger?.warn(
        {
          reason: "cognito_get_user_failed",
          errorName: typeof errorName === "string" ? errorName : "unknown",
          errorCode: typeof errorCode === "string" ? errorCode : "unknown"
        },
        "Token email enrichment failed; continuing with JWT claims only"
      );
    }

    return principal;
  }
}

import { CognitoIdentityProviderClient, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

import type { AuthenticatedPrincipal, TokenVerifier } from "./token-verifier.js";

/**
 * Cognito access tokens often omit the `email` claim; `GetUser` with the same access token
 * returns verified attributes including email for display and `/me`.
 */
export class CognitoEmailEnrichingTokenVerifier implements TokenVerifier {
  public constructor(
    private readonly inner: TokenVerifier,
    private readonly cognitoClient: CognitoIdentityProviderClient
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
          email,
          username: email
        };
      }
    } catch {
      // JWT verification already succeeded; enrichment is best-effort only.
    }

    return principal;
  }
}

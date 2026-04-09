import { createRemoteJWKSet, jwtVerify } from "jose";

import { ApiError } from "../../shared/api-error.js";
import type { AuthenticatedPrincipal, TokenVerifier } from "./token-verifier.js";

interface JoseVerifierOptions {
  issuerUrl: string;
  jwksUrl: string;
  audience?: string;
  cognitoClientId?: string;
  expectedTokenUse?: "access" | "id";
}

export class JoseTokenVerifier implements TokenVerifier {
  private readonly issuerUrl: string;
  private readonly audience?: string;
  private readonly cognitoClientId?: string;
  private readonly expectedTokenUse?: "access" | "id";
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  public constructor(options: JoseVerifierOptions) {
    this.issuerUrl = options.issuerUrl;
    this.audience = options.audience;
    this.cognitoClientId = options.cognitoClientId;
    this.expectedTokenUse = options.expectedTokenUse;
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl));
  }

  public async verify(token: string): Promise<AuthenticatedPrincipal> {
    try {
      const verifyOptions: { issuer: string; audience?: string } = {
        issuer: this.issuerUrl,
        audience: this.audience
      };
      if (!this.audience) {
        delete verifyOptions.audience;
      }
      const { payload } = await jwtVerify(token, this.jwks, verifyOptions);

      const sub = typeof payload.sub === "string" ? payload.sub : null;
      if (!sub) {
        throw new ApiError(401, "AUTH_INVALID_SUB", "Token missing required subject claim");
      }
      if (this.cognitoClientId) {
        const clientId = typeof payload.client_id === "string" ? payload.client_id : null;
        if (clientId !== this.cognitoClientId) {
          throw new ApiError(401, "AUTH_INVALID_TOKEN", "Token has unexpected client_id");
        }
      }
      if (this.expectedTokenUse) {
        const tokenUse = typeof payload.token_use === "string" ? payload.token_use : null;
        if (tokenUse !== this.expectedTokenUse) {
          throw new ApiError(401, "AUTH_INVALID_TOKEN", "Token has unexpected token_use");
        }
      }

      const usernameCandidate =
        typeof payload.preferred_username === "string"
          ? payload.preferred_username
          : typeof payload.name === "string"
            ? payload.name
            : typeof payload.sub === "string"
              ? payload.sub
              : "unknown";

      const emailCandidate = typeof payload.email === "string" ? payload.email : null;
      const scopes = typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [];

      return {
        actorSub: sub,
        username: usernameCandidate,
        email: emailCandidate,
        scopes
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(401, "AUTH_INVALID_TOKEN", "Token validation failed");
    }
  }
}

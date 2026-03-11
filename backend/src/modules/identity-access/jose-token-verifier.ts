import { createRemoteJWKSet, jwtVerify } from "jose";

import { ApiError } from "../../shared/api-error.js";
import type { AuthenticatedPrincipal, TokenVerifier } from "./token-verifier.js";

interface JoseVerifierOptions {
  issuerUrl: string;
  audience: string;
  jwksUrl: string;
}

export class JoseTokenVerifier implements TokenVerifier {
  private readonly issuerUrl: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  public constructor(options: JoseVerifierOptions) {
    this.issuerUrl = options.issuerUrl;
    this.audience = options.audience;
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl));
  }

  public async verify(token: string): Promise<AuthenticatedPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuerUrl,
        audience: this.audience
      });

      const sub = typeof payload.sub === "string" ? payload.sub : null;
      if (!sub) {
        throw new ApiError(401, "AUTH_INVALID_SUB", "Token missing required subject claim");
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

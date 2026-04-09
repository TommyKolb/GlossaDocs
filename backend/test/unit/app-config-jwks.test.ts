import { describe, expect, it } from "vitest";

import { resolveDefaultJwksUrl } from "../../src/app.js";

describe("resolveDefaultJwksUrl", () => {
  it("uses Cognito JWKS default for cognito provider", () => {
    const jwksUrl = resolveDefaultJwksUrl(
      {
        NODE_ENV: "test",
        API_PORT: 4000,
        CORS_ALLOWED_ORIGINS: "*",
        AUTH_PROVIDER: "cognito"
      },
      "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_pool/"
    );

    expect(jwksUrl).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_pool/.well-known/jwks.json");
  });

  it("uses Keycloak-style JWKS default for non-cognito provider", () => {
    const jwksUrl = resolveDefaultJwksUrl(
      {
        NODE_ENV: "test",
        API_PORT: 4000,
        CORS_ALLOWED_ORIGINS: "*",
        AUTH_PROVIDER: "keycloak"
      },
      "http://localhost:8080/realms/glossadocs/"
    );

    expect(jwksUrl).toBe("http://localhost:8080/realms/glossadocs/protocol/openid-connect/certs");
  });
});

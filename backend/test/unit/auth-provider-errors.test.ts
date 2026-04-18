import { describe, expect, it } from "vitest";

import { getAuthProviderErrorCode } from "../../src/modules/identity-access/auth-provider-errors.js";
import { CognitoAdminClientError } from "../../src/modules/identity-access/cognito-admin-client.js";
import { CognitoOidcClientError } from "../../src/modules/identity-access/cognito-oidc-client.js";
import { KeycloakAdminClientError } from "../../src/modules/identity-access/keycloak-admin-client.js";
import { KeycloakOidcClientError } from "../../src/modules/identity-access/keycloak-oidc-client.js";

describe("getAuthProviderErrorCode", () => {
  it("extracts code from known provider error classes", () => {
    expect(
      getAuthProviderErrorCode(
        new KeycloakOidcClientError("KEYCLOAK_OIDC_INVALID_CREDENTIALS", "invalid credentials")
      )
    ).toBe("KEYCLOAK_OIDC_INVALID_CREDENTIALS");
    expect(getAuthProviderErrorCode(new KeycloakAdminClientError("KEYCLOAK_USER_EXISTS", "exists"))).toBe(
      "KEYCLOAK_USER_EXISTS"
    );
    expect(
      getAuthProviderErrorCode(
        new CognitoOidcClientError("COGNITO_OIDC_INVALID_CREDENTIALS", "invalid credentials")
      )
    ).toBe("COGNITO_OIDC_INVALID_CREDENTIALS");
    expect(getAuthProviderErrorCode(new CognitoAdminClientError("COGNITO_USER_EXISTS", "exists"))).toBe(
      "COGNITO_USER_EXISTS"
    );
  });

  it("supports plain objects with string code fallback", () => {
    expect(getAuthProviderErrorCode({ code: "COGNITO_OIDC_UNAVAILABLE" })).toBe(
      "COGNITO_OIDC_UNAVAILABLE"
    );
    expect(getAuthProviderErrorCode({ code: 123 })).toBeNull();
  });
});

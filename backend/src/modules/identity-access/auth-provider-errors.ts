import { CognitoAdminClientError } from "./cognito-admin-client.js";
import { CognitoOidcClientError } from "./cognito-oidc-client.js";
import { KeycloakAdminClientError } from "./keycloak-admin-client.js";
import { KeycloakOidcClientError } from "./keycloak-oidc-client.js";

export function getAuthProviderErrorCode(error: unknown): string | null {
  if (
    error instanceof KeycloakOidcClientError ||
    error instanceof KeycloakAdminClientError ||
    error instanceof CognitoOidcClientError ||
    error instanceof CognitoAdminClientError
  ) {
    return error.code;
  }

  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

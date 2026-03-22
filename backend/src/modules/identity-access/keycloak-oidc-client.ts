import { ApiError } from "../../shared/api-error.js";

export type KeycloakOidcClientErrorCode =
  | "KEYCLOAK_OIDC_INVALID_CREDENTIALS"
  | "KEYCLOAK_OIDC_UNAVAILABLE";

export class KeycloakOidcClientError extends Error {
  public readonly code: KeycloakOidcClientErrorCode;

  public constructor(code: KeycloakOidcClientErrorCode, message: string) {
    super(message);
    this.name = "KeycloakOidcClientError";
    this.code = code;
  }
}

export interface KeycloakPasswordLoginResult {
  accessToken: string;
  expiresInSeconds: number;
}

export interface KeycloakOidcClient {
  loginWithPassword(args: { username: string; password: string }): Promise<KeycloakPasswordLoginResult>;
}

interface KeycloakOidcClientConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
}

export function requireKeycloakOidcClientConfig(
  config: Partial<KeycloakOidcClientConfig>
): KeycloakOidcClientConfig {
  const { tokenUrl, clientId, clientSecret } = config;
  if (!tokenUrl || !clientId) {
    throw new ApiError(
      500,
      "CONFIG_KEYCLOAK_OIDC_INCOMPLETE",
      "Keycloak OIDC login configuration is missing"
    );
  }
  return { tokenUrl, clientId, clientSecret };
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

export class HttpKeycloakOidcClient implements KeycloakOidcClient {
  private readonly config: KeycloakOidcClientConfig;

  public constructor(config: KeycloakOidcClientConfig) {
    this.config = config;
  }

  public async loginWithPassword(args: {
    username: string;
    password: string;
  }): Promise<KeycloakPasswordLoginResult> {
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: this.config.clientId,
      username: args.username,
      password: args.password,
      scope: "openid profile email"
    });

    if (this.config.clientSecret) {
      body.set("client_secret", this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).catch(() => null);

    if (!response) {
      throw new KeycloakOidcClientError(
        "KEYCLOAK_OIDC_UNAVAILABLE",
        "Keycloak token endpoint request failed"
      );
    }

    const data = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok) {
      if (response.status === 400 && data.error === "invalid_grant") {
        throw new KeycloakOidcClientError(
          "KEYCLOAK_OIDC_INVALID_CREDENTIALS",
          "Invalid username or password"
        );
      }
      throw new KeycloakOidcClientError(
        "KEYCLOAK_OIDC_UNAVAILABLE",
        "Keycloak token endpoint returned an error"
      );
    }

    if (!data.access_token || typeof data.expires_in !== "number") {
      throw new KeycloakOidcClientError(
        "KEYCLOAK_OIDC_UNAVAILABLE",
        "Keycloak token response is missing required fields"
      );
    }

    return {
      accessToken: data.access_token,
      expiresInSeconds: data.expires_in
    };
  }
}

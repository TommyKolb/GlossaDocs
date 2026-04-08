import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  type InitiateAuthCommandInput
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "node:crypto";

import { ApiError } from "../../shared/api-error.js";

export type CognitoOidcClientErrorCode =
  | "COGNITO_OIDC_INVALID_CREDENTIALS"
  | "COGNITO_OIDC_UNAVAILABLE";

export class CognitoOidcClientError extends Error {
  public readonly code: CognitoOidcClientErrorCode;

  public constructor(code: CognitoOidcClientErrorCode, message: string) {
    super(message);
    this.name = "CognitoOidcClientError";
    this.code = code;
  }
}

export interface CognitoPasswordLoginResult {
  accessToken: string;
  expiresInSeconds: number;
}

export interface CognitoOidcClient {
  loginWithPassword(args: { username: string; password: string }): Promise<CognitoPasswordLoginResult>;
}

interface CognitoOidcClientConfig {
  region: string;
  clientId: string;
  clientSecret?: string;
}

export function requireCognitoOidcClientConfig(
  config: Partial<CognitoOidcClientConfig>
): CognitoOidcClientConfig {
  const { region, clientId, clientSecret } = config;
  if (!region || !clientId) {
    throw new ApiError(
      500,
      "CONFIG_COGNITO_OIDC_INCOMPLETE",
      "Cognito OIDC login configuration is missing"
    );
  }
  return { region, clientId, clientSecret };
}

function isCognitoInvalidCredentialsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = (error as { name?: string }).name;
  return name === "NotAuthorizedException" || name === "UserNotFoundException";
}

function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  return createHmac("sha256", clientSecret).update(`${username}${clientId}`).digest("base64");
}

export class HttpCognitoOidcClient implements CognitoOidcClient {
  private readonly config: CognitoOidcClientConfig;
  private readonly client: CognitoIdentityProviderClient;

  public constructor(config: CognitoOidcClientConfig) {
    this.config = config;
    this.client = new CognitoIdentityProviderClient({ region: config.region });
  }

  public async loginWithPassword(args: {
    username: string;
    password: string;
  }): Promise<CognitoPasswordLoginResult> {
    const authParameters: NonNullable<InitiateAuthCommandInput["AuthParameters"]> = {
      USERNAME: args.username,
      PASSWORD: args.password
    };
    if (this.config.clientSecret) {
      authParameters.SECRET_HASH = computeSecretHash(
        args.username,
        this.config.clientId,
        this.config.clientSecret
      );
    }

    const command = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: this.config.clientId,
      AuthParameters: authParameters
    });

    let response;
    try {
      response = await this.client.send(command);
    } catch (error) {
      if (isCognitoInvalidCredentialsError(error)) {
        throw new CognitoOidcClientError(
          "COGNITO_OIDC_INVALID_CREDENTIALS",
          "Invalid username or password"
        );
      }
      throw new CognitoOidcClientError(
        "COGNITO_OIDC_UNAVAILABLE",
        "Cognito login request failed"
      );
    }

    const accessToken = response.AuthenticationResult?.AccessToken;
    const expiresInSeconds = response.AuthenticationResult?.ExpiresIn;

    if (!accessToken || typeof expiresInSeconds !== "number") {
      throw new CognitoOidcClientError(
        "COGNITO_OIDC_UNAVAILABLE",
        "Cognito token response is missing required fields"
      );
    }

    return {
      accessToken,
      expiresInSeconds
    };
  }
}

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  type InitiateAuthCommandInput
} from "@aws-sdk/client-cognito-identity-provider";

import { ApiError } from "../../shared/api-error.js";
import { computeCognitoSecretHash } from "./cognito-secret-hash.js";

export type CognitoOidcClientErrorCode =
  | "COGNITO_OIDC_INVALID_CREDENTIALS"
  | "COGNITO_OIDC_EMAIL_NOT_VERIFIED"
  | "COGNITO_OIDC_AUTH_CHALLENGE"
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

function cognitoErrorName(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  return (error as { name?: string }).name;
}

function isCognitoInvalidCredentialsError(error: unknown): boolean {
  const name = cognitoErrorName(error);
  return name === "NotAuthorizedException" || name === "UserNotFoundException";
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
      authParameters.SECRET_HASH = computeCognitoSecretHash(
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
      if (cognitoErrorName(error) === "UserNotConfirmedException") {
        throw new CognitoOidcClientError(
          "COGNITO_OIDC_EMAIL_NOT_VERIFIED",
          "This account is not confirmed yet. Complete email verification or sign up again."
        );
      }
      throw new CognitoOidcClientError(
        "COGNITO_OIDC_UNAVAILABLE",
        "Cognito login request failed"
      );
    }

    if (response.ChallengeName) {
      throw new CognitoOidcClientError(
        "COGNITO_OIDC_AUTH_CHALLENGE",
        `Cognito returned an authentication challenge (${response.ChallengeName}) that this app does not handle.`
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

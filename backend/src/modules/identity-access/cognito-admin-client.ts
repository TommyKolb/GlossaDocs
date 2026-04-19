import {
  AdminConfirmSignUpCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  ListUsersCommand,
  SignUpCommand
} from "@aws-sdk/client-cognito-identity-provider";

import { ApiError } from "../../shared/api-error.js";
import { computeCognitoSecretHash } from "./cognito-secret-hash.js";
import { getCognitoErrorName, getErrorMessage } from "./cognito-sdk-errors.js";

export type CognitoAdminClientErrorCode =
  | "COGNITO_USER_EXISTS"
  | "COGNITO_USER_NOT_FOUND"
  | "COGNITO_INVALID_PASSWORD"
  | "COGNITO_INVALID_PARAMETER"
  | "COGNITO_CONFIRMATION_FAILED"
  | "COGNITO_RESET_CODE_INVALID"
  | "COGNITO_RESET_CODE_EXPIRED"
  | "COGNITO_ADMIN_UNAVAILABLE";

export class CognitoAdminClientError extends Error {
  public readonly code: CognitoAdminClientErrorCode;

  public constructor(code: CognitoAdminClientErrorCode, message: string) {
    super(message);
    this.name = "CognitoAdminClientError";
    this.code = code;
  }
}

export interface CognitoAdminClient {
  createUser(args: { email: string; password: string }): Promise<void>;
  sendPasswordResetEmail(args: { email: string }): Promise<void>;
  confirmForgotPassword(args: { email: string; code: string; newPassword: string }): Promise<void>;
}

interface CognitoAdminClientConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  clientSecret?: string;
}

export function requireCognitoAdminConfig(
  config: Partial<CognitoAdminClientConfig>
): CognitoAdminClientConfig {
  const { region, userPoolId, clientId, clientSecret } = config;
  if (!region || !userPoolId || !clientId) {
    throw new ApiError(
      500,
      "CONFIG_COGNITO_ADMIN_INCOMPLETE",
      "Cognito admin configuration is missing"
    );
  }
  return { region, userPoolId, clientId, clientSecret };
}

function mapCognitoAdminError(error: unknown): never {
  const name = getCognitoErrorName(error);
  const message = getErrorMessage(error, "Cognito admin request failed");
  if (name === "UsernameExistsException") {
    throw new CognitoAdminClientError("COGNITO_USER_EXISTS", "User already exists");
  }
  if (name === "UserNotFoundException") {
    throw new CognitoAdminClientError("COGNITO_USER_NOT_FOUND", "User not found");
  }
  if (name === "InvalidPasswordException") {
    throw new CognitoAdminClientError("COGNITO_INVALID_PASSWORD", message);
  }
  if (name === "InvalidParameterException") {
    throw new CognitoAdminClientError("COGNITO_INVALID_PARAMETER", message);
  }
  throw new CognitoAdminClientError("COGNITO_ADMIN_UNAVAILABLE", message);
}

function mapCognitoConfirmForgotPasswordError(error: unknown): never {
  const name = getCognitoErrorName(error);
  const message = getErrorMessage(error, "Unable to reset password");
  if (name === "CodeMismatchException") {
    throw new CognitoAdminClientError("COGNITO_RESET_CODE_INVALID", "Invalid verification code.");
  }
  if (name === "ExpiredCodeException") {
    throw new CognitoAdminClientError(
      "COGNITO_RESET_CODE_EXPIRED",
      "Verification code has expired. Request a new reset email."
    );
  }
  if (name === "InvalidPasswordException") {
    throw new CognitoAdminClientError("COGNITO_INVALID_PASSWORD", message);
  }
  if (name === "InvalidParameterException") {
    throw new CognitoAdminClientError("COGNITO_INVALID_PARAMETER", message);
  }
  if (name === "UserNotFoundException") {
    throw new CognitoAdminClientError("COGNITO_USER_NOT_FOUND", "User not found");
  }
  throw new CognitoAdminClientError("COGNITO_ADMIN_UNAVAILABLE", message);
}

async function findCognitoUsernameByEmail(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  email: string
): Promise<string | null> {
  const escaped = email.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const result = await client.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${escaped}"`,
      Limit: 2
    })
  );
  const users = result.Users ?? [];
  if (users.length !== 1 || !users[0]?.Username) {
    return null;
  }
  return users[0].Username;
}

export class HttpCognitoAdminClient implements CognitoAdminClient {
  private readonly config: CognitoAdminClientConfig;
  private readonly client: CognitoIdentityProviderClient;

  public constructor(
    config: CognitoAdminClientConfig,
    deps: { cognitoClient?: CognitoIdentityProviderClient } = {}
  ) {
    this.config = config;
    this.client = deps.cognitoClient ?? new CognitoIdentityProviderClient({ region: config.region });
  }

  private async confirmUserWithRetry(username: string): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.client.send(
          new AdminConfirmSignUpCommand({
            UserPoolId: this.config.userPoolId,
            Username: username
          })
        );
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          const message = getErrorMessage(error, "Cognito user confirmation failed");
          throw new CognitoAdminClientError("COGNITO_CONFIRMATION_FAILED", message);
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
      }
    }
  }

  public async createUser(args: { email: string; password: string }): Promise<void> {
    const secretHash = this.config.clientSecret
      ? computeCognitoSecretHash(args.email, this.config.clientId, this.config.clientSecret)
      : undefined;

    let signUpResult;
    try {
      signUpResult = await this.client.send(
        new SignUpCommand({
          ClientId: this.config.clientId,
          Username: args.email,
          Password: args.password,
          SecretHash: secretHash,
          UserAttributes: [{ Name: "email", Value: args.email }]
        })
      );

    } catch (error) {
      mapCognitoAdminError(error);
    }

    // App-hosted sign-up should not require email verification for login. Cognito leaves new users
    // UNCONFIRMED after SignUp unless a trigger confirms them; USER_PASSWORD_AUTH then fails.
    if (signUpResult.UserConfirmed !== true) {
      await this.confirmUserWithRetry(args.email);
    }
  }

  public async sendPasswordResetEmail(args: { email: string }): Promise<void> {
    const trimmedEmail = args.email.trim();
    const tryForgot = async (username: string): Promise<void> => {
      const secretHash = this.config.clientSecret
        ? computeCognitoSecretHash(username, this.config.clientId, this.config.clientSecret)
        : undefined;
      await this.client.send(
        new ForgotPasswordCommand({
          ClientId: this.config.clientId,
          Username: username,
          SecretHash: secretHash
        })
      );
    };

    try {
      await tryForgot(trimmedEmail);
    } catch (error) {
      if (getCognitoErrorName(error) !== "UserNotFoundException") {
        mapCognitoAdminError(error);
      }
      const resolved = await findCognitoUsernameByEmail(
        this.client,
        this.config.userPoolId,
        trimmedEmail
      );
      if (!resolved) {
        mapCognitoAdminError(error);
      }
      try {
        await tryForgot(resolved);
      } catch (retryError) {
        mapCognitoAdminError(retryError);
      }
    }
  }

  public async confirmForgotPassword(args: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<void> {
    const secretHash = this.config.clientSecret
      ? computeCognitoSecretHash(args.email, this.config.clientId, this.config.clientSecret)
      : undefined;

    try {
      await this.client.send(
        new ConfirmForgotPasswordCommand({
          ClientId: this.config.clientId,
          Username: args.email.trim(),
          ConfirmationCode: args.code.trim(),
          Password: args.newPassword,
          SecretHash: secretHash
        })
      );
    } catch (error) {
      mapCognitoConfirmForgotPasswordError(error);
    }
  }
}

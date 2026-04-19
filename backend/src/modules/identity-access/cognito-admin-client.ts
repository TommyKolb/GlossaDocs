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

function buildSecretHash(config: CognitoAdminClientConfig, username: string): string | undefined {
  return config.clientSecret
    ? computeCognitoSecretHash(username, config.clientId, config.clientSecret)
    : undefined;
}

function throwMappedCognitoError(args: {
  error: unknown;
  fallbackMessage: string;
  mappings: Record<string, { code: CognitoAdminClientErrorCode; message?: string }>;
  defaultCode: CognitoAdminClientErrorCode;
}): never {
  const name = getCognitoErrorName(args.error);
  const originalMessage = getErrorMessage(args.error, args.fallbackMessage);
  const mapped = typeof name === "string" ? args.mappings[name] : undefined;
  if (mapped) {
    throw new CognitoAdminClientError(mapped.code, mapped.message ?? originalMessage);
  }
  throw new CognitoAdminClientError(args.defaultCode, originalMessage);
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
  throwMappedCognitoError({
    error,
    fallbackMessage: "Cognito admin request failed",
    defaultCode: "COGNITO_ADMIN_UNAVAILABLE",
    mappings: {
      UsernameExistsException: { code: "COGNITO_USER_EXISTS", message: "User already exists" },
      UserNotFoundException: { code: "COGNITO_USER_NOT_FOUND", message: "User not found" },
      InvalidPasswordException: { code: "COGNITO_INVALID_PASSWORD" },
      InvalidParameterException: { code: "COGNITO_INVALID_PARAMETER" }
    }
  });
}

function mapCognitoConfirmForgotPasswordError(error: unknown): never {
  throwMappedCognitoError({
    error,
    fallbackMessage: "Unable to reset password",
    defaultCode: "COGNITO_ADMIN_UNAVAILABLE",
    mappings: {
      CodeMismatchException: {
        code: "COGNITO_RESET_CODE_INVALID",
        message: "Invalid verification code."
      },
      ExpiredCodeException: {
        code: "COGNITO_RESET_CODE_EXPIRED",
        message: "Verification code has expired. Request a new reset email."
      },
      InvalidPasswordException: { code: "COGNITO_INVALID_PASSWORD" },
      InvalidParameterException: { code: "COGNITO_INVALID_PARAMETER" },
      UserNotFoundException: { code: "COGNITO_USER_NOT_FOUND", message: "User not found" }
    }
  });
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

  private async tryForgotPasswordWithUsername(username: string): Promise<void> {
    await this.client.send(
      new ForgotPasswordCommand({
        ClientId: this.config.clientId,
        Username: username,
        SecretHash: buildSecretHash(this.config, username)
      })
    );
  }

  private async tryConfirmForgotPasswordWithUsername(args: {
    username: string;
    code: string;
    newPassword: string;
  }): Promise<void> {
    await this.client.send(
      new ConfirmForgotPasswordCommand({
        ClientId: this.config.clientId,
        Username: args.username,
        ConfirmationCode: args.code.trim(),
        Password: args.newPassword,
        SecretHash: buildSecretHash(this.config, args.username)
      })
    );
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

    try {
      await this.tryForgotPasswordWithUsername(trimmedEmail);
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
        await this.tryForgotPasswordWithUsername(resolved);
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
    const trimmedEmail = args.email.trim();

    try {
      await this.tryConfirmForgotPasswordWithUsername({
        username: trimmedEmail,
        code: args.code,
        newPassword: args.newPassword
      });
    } catch (error) {
      if (getCognitoErrorName(error) !== "UserNotFoundException") {
        mapCognitoConfirmForgotPasswordError(error);
      }
      const resolved = await findCognitoUsernameByEmail(
        this.client,
        this.config.userPoolId,
        trimmedEmail
      );
      if (!resolved) {
        mapCognitoConfirmForgotPasswordError(error);
      }
      try {
        await this.tryConfirmForgotPasswordWithUsername({
          username: resolved,
          code: args.code,
          newPassword: args.newPassword
        });
        return;
      } catch (retryError) {
        mapCognitoConfirmForgotPasswordError(retryError);
      }
      mapCognitoConfirmForgotPasswordError(error);
    }
  }
}

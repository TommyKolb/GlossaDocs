import {
  AdminConfirmSignUpCommand,
  ForgotPasswordCommand,
  SignUpCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { describe, expect, it, vi } from "vitest";

import {
  CognitoAdminClientError,
  HttpCognitoAdminClient,
  requireCognitoAdminConfig
} from "../../src/modules/identity-access/cognito-admin-client.js";
import { ApiError } from "../../src/shared/api-error.js";

describe("requireCognitoAdminConfig", () => {
  it("throws when required fields are missing", () => {
    expect(() => requireCognitoAdminConfig({ region: "us-east-1", userPoolId: "pool" })).toThrow(ApiError);
    expect(() => requireCognitoAdminConfig({ region: "us-east-1", clientId: "client" })).toThrow(ApiError);
  });
});

describe("HttpCognitoAdminClient", () => {
  function createClient(send: ReturnType<typeof vi.fn>, withSecret = false): HttpCognitoAdminClient {
    const cognitoClient = { send } as any;
    return new HttpCognitoAdminClient(
      {
        region: "us-east-1",
        userPoolId: "pool",
        clientId: "client",
        clientSecret: withSecret ? "client-secret" : undefined
      },
      { cognitoClient }
    );
  }

  it("maps UsernameExistsException for createUser", async () => {
    const client = createClient(
      vi.fn(async () => {
        const err = new Error("exists");
        (err as Error & { name: string }).name = "UsernameExistsException";
        throw err;
      })
    );

    await expect(client.createUser({ email: "taken@example.com", password: "secret123" })).rejects.toMatchObject({
      code: "COGNITO_USER_EXISTS"
    });
  });

  it("calls AdminConfirmSignUp after SignUp when UserConfirmed is false", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ UserConfirmed: false })
      .mockResolvedValueOnce({});
    const client = createClient(send);

    await client.createUser({ email: "new@example.com", password: "ValidPass123!Aa" });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(SignUpCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(AdminConfirmSignUpCommand);
  });

  it("skips AdminConfirmSignUp when SignUp already confirms the user", async () => {
    const send = vi.fn().mockResolvedValueOnce({ UserConfirmed: true });
    const client = createClient(send);

    await client.createUser({ email: "new@example.com", password: "ValidPass123!Aa" });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("maps InvalidPasswordException for createUser", async () => {
    const client = createClient(
      vi.fn(async () => {
        const err = new Error("Password did not conform with policy");
        (err as Error & { name: string }).name = "InvalidPasswordException";
        throw err;
      })
    );

    await expect(client.createUser({ email: "u@example.com", password: "weak" })).rejects.toMatchObject({
      code: "COGNITO_INVALID_PASSWORD"
    });
  });

  it("accepts successful password reset", async () => {
    const sendMock = vi.fn(async () => ({}));
    const client = createClient(sendMock);

    await expect(client.sendPasswordResetEmail({ email: "user@example.com" })).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(ForgotPasswordCommand);
  });

  it("retries user confirmation and eventually succeeds", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ UserConfirmed: false })
      .mockImplementationOnce(async () => {
        const err = new Error("temporary failure");
        (err as Error & { name: string }).name = "InternalErrorException";
        throw err;
      })
      .mockResolvedValueOnce({});
    const client = createClient(send);
    await client.createUser({ email: "new@example.com", password: "ValidPass123!Aa" });

    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(AdminConfirmSignUpCommand);
    expect(send.mock.calls[2]?.[0]).toBeInstanceOf(AdminConfirmSignUpCommand);
  });

  it("returns explicit confirmation error after retries are exhausted", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ UserConfirmed: false })
      .mockImplementation(async () => {
        const err = new Error("confirm still failing");
        (err as Error & { name: string }).name = "InternalErrorException";
        throw err;
      });
    const client = createClient(send);
    await expect(client.createUser({ email: "new@example.com", password: "ValidPass123!Aa" })).rejects.toEqual(
      new CognitoAdminClientError("COGNITO_CONFIRMATION_FAILED", "confirm still failing")
    );
  });

  it("passes SecretHash for sign-up and forgot-password when client secret is configured", async () => {
    const send = vi.fn().mockResolvedValue({ UserConfirmed: true });
    const client = createClient(send, true);

    await client.createUser({ email: "new@example.com", password: "ValidPass123!Aa" });
    await client.sendPasswordResetEmail({ email: "new@example.com" });

    const signUpInput = (send.mock.calls[0]?.[0] as SignUpCommand).input;
    const forgotInput = (send.mock.calls[1]?.[0] as ForgotPasswordCommand).input;
    expect(signUpInput.SecretHash).toBeTypeOf("string");
    expect(forgotInput.SecretHash).toBeTypeOf("string");
  });
});

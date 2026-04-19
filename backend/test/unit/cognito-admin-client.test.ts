import {
  AdminConfirmSignUpCommand,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  ListUsersCommand,
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
    const sendMock = vi.fn(async (_command: unknown) => ({}));
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

  it("confirms forgot password with SecretHash when client secret is configured", async () => {
    const send = vi.fn().mockResolvedValue({});
    const client = createClient(send, true);

    await client.confirmForgotPassword({
      email: "user@example.com",
      code: "123456",
      newPassword: "ValidPass123!Aa"
    });

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(ConfirmForgotPasswordCommand);
    const input = (send.mock.calls[0]?.[0] as ConfirmForgotPasswordCommand).input;
    expect(input?.Username).toBe("user@example.com");
    expect(input?.ConfirmationCode).toBe("123456");
    expect(input?.SecretHash).toBeTypeOf("string");
  });

  it("maps CodeMismatchException for confirmForgotPassword", async () => {
    const send = vi.fn().mockImplementation(async () => {
      const err = new Error("bad code");
      (err as Error & { name: string }).name = "CodeMismatchException";
      throw err;
    });
    const client = createClient(send);

    await expect(
      client.confirmForgotPassword({
        email: "user@example.com",
        code: "bad",
        newPassword: "ValidPass123!Aa"
      })
    ).rejects.toMatchObject({ code: "COGNITO_RESET_CODE_INVALID" });
  });

  it("retries confirm with resolved username when email is not the Cognito username", async () => {
    const send = vi
      .fn()
      .mockImplementationOnce(async () => {
        const err = new Error("not found");
        (err as Error & { name: string }).name = "UserNotFoundException";
        throw err;
      })
      .mockResolvedValueOnce({
        Users: [{ Username: "uuid-username-1" }]
      })
      .mockResolvedValueOnce({});
    const client = createClient(send, true);

    await client.confirmForgotPassword({
      email: "user@example.com",
      code: "123456",
      newPassword: "ValidPass123!Aa"
    });

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(ConfirmForgotPasswordCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(ListUsersCommand);
    expect(send.mock.calls[2]?.[0]).toBeInstanceOf(ConfirmForgotPasswordCommand);
    const firstInput = (send.mock.calls[0]?.[0] as ConfirmForgotPasswordCommand).input;
    const retryInput = (send.mock.calls[2]?.[0] as ConfirmForgotPasswordCommand).input;
    expect(firstInput?.Username).toBe("user@example.com");
    expect(retryInput?.Username).toBe("uuid-username-1");
    expect(firstInput?.SecretHash).toBeTypeOf("string");
    expect(retryInput?.SecretHash).toBeTypeOf("string");
    expect(firstInput?.SecretHash).not.toEqual(retryInput?.SecretHash);
  });

  it("retries ForgotPassword with resolved username when email is not the Cognito username", async () => {
    const send = vi
      .fn()
      .mockImplementationOnce(async () => {
        const err = new Error("not found");
        (err as Error & { name: string }).name = "UserNotFoundException";
        throw err;
      })
      .mockResolvedValueOnce({
        Users: [{ Username: "uuid-username-1" }]
      })
      .mockResolvedValueOnce({});

    const client = createClient(send);

    await client.sendPasswordResetEmail({ email: "user@example.com" });

    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(ListUsersCommand);
    expect((send.mock.calls[2]?.[0] as ForgotPasswordCommand).input?.Username).toBe("uuid-username-1");
  });
});

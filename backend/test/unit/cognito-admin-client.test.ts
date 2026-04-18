import { AdminConfirmSignUpCommand, SignUpCommand } from "@aws-sdk/client-cognito-identity-provider";
import { describe, expect, it, vi } from "vitest";

import {
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
  it("maps UsernameExistsException for createUser", async () => {
    const client = new HttpCognitoAdminClient({
      region: "us-east-1",
      userPoolId: "pool",
      clientId: "client"
    });
    (client as any).client = {
      send: vi.fn(async () => {
        const err = new Error("exists");
        (err as Error & { name: string }).name = "UsernameExistsException";
        throw err;
      })
    };

    await expect(client.createUser({ email: "taken@example.com", password: "secret123" })).rejects.toMatchObject({
      code: "COGNITO_USER_EXISTS"
    });
  });

  it("calls AdminConfirmSignUp after SignUp when UserConfirmed is false", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ UserConfirmed: false })
      .mockResolvedValueOnce({});
    const client = new HttpCognitoAdminClient({
      region: "us-east-1",
      userPoolId: "us-east-1_pool",
      clientId: "client"
    });
    (client as any).client = { send };

    await client.createUser({ email: "new@example.com", password: "ValidPass123!Aa" });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(SignUpCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(AdminConfirmSignUpCommand);
  });

  it("skips AdminConfirmSignUp when SignUp already confirms the user", async () => {
    const send = vi.fn().mockResolvedValueOnce({ UserConfirmed: true });
    const client = new HttpCognitoAdminClient({
      region: "us-east-1",
      userPoolId: "us-east-1_pool",
      clientId: "client"
    });
    (client as any).client = { send };

    await client.createUser({ email: "new@example.com", password: "ValidPass123!Aa" });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("maps InvalidPasswordException for createUser", async () => {
    const client = new HttpCognitoAdminClient({
      region: "us-east-1",
      userPoolId: "pool",
      clientId: "client"
    });
    (client as any).client = {
      send: vi.fn(async () => {
        const err = new Error("Password did not conform with policy");
        (err as Error & { name: string }).name = "InvalidPasswordException";
        throw err;
      })
    };

    await expect(client.createUser({ email: "u@example.com", password: "weak" })).rejects.toMatchObject({
      code: "COGNITO_INVALID_PASSWORD"
    });
  });

  it("accepts successful password reset", async () => {
    const sendMock = vi.fn(async () => ({}));
    const client = new HttpCognitoAdminClient({
      region: "us-east-1",
      userPoolId: "pool",
      clientId: "client"
    });
    (client as any).client = { send: sendMock };

    await expect(client.sendPasswordResetEmail({ email: "user@example.com" })).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

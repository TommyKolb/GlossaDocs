import { describe, expect, it, vi } from "vitest";

import {
  CognitoAdminClientError,
  HttpCognitoAdminClient,
  isCognitoAdminErrorCode,
  requireCognitoAdminConfig
} from "../../src/modules/identity-access/cognito-admin-client.js";
import { ApiError } from "../../src/shared/api-error.js";

describe("isCognitoAdminErrorCode", () => {
  it("matches typed errors and plain object error payloads", () => {
    const err = new CognitoAdminClientError("COGNITO_USER_EXISTS", "exists");
    expect(isCognitoAdminErrorCode(err, "COGNITO_USER_EXISTS")).toBe(true);
    expect(isCognitoAdminErrorCode({ code: "COGNITO_USER_NOT_FOUND" }, "COGNITO_USER_NOT_FOUND")).toBe(
      true
    );
    expect(isCognitoAdminErrorCode("bad", "COGNITO_USER_EXISTS")).toBe(false);
  });
});

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

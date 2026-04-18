import { describe, expect, it, vi } from "vitest";

import {
  HttpCognitoOidcClient,
  requireCognitoOidcClientConfig
} from "../../src/modules/identity-access/cognito-oidc-client.js";
import { ApiError } from "../../src/shared/api-error.js";

describe("requireCognitoOidcClientConfig", () => {
  it("throws when region or clientId are missing", () => {
    expect(() => requireCognitoOidcClientConfig({ region: "us-east-1" })).toThrow(ApiError);
    expect(() => requireCognitoOidcClientConfig({ clientId: "abc" })).toThrow(ApiError);
  });

  it("returns config when required values are present", () => {
    expect(
      requireCognitoOidcClientConfig({
        region: "us-east-1",
        clientId: "client123",
        clientSecret: "secret"
      })
    ).toEqual({
      region: "us-east-1",
      clientId: "client123",
      clientSecret: "secret"
    });
  });
});

describe("HttpCognitoOidcClient", () => {
  it("maps NotAuthorizedException to invalid credentials", async () => {
    const client = new HttpCognitoOidcClient({ region: "us-east-1", clientId: "client123" });
    (client as any).client = {
      send: vi.fn(async () => {
        const err = new Error("not authorized");
        (err as Error & { name: string }).name = "NotAuthorizedException";
        throw err;
      })
    };

    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "wrong" })
    ).rejects.toMatchObject({
      code: "COGNITO_OIDC_INVALID_CREDENTIALS"
    });
  });

  it("maps UserNotConfirmedException to email not verified", async () => {
    const client = new HttpCognitoOidcClient({ region: "us-east-1", clientId: "client123" });
    (client as any).client = {
      send: vi.fn(async () => {
        const err = new Error("not confirmed");
        (err as Error & { name: string }).name = "UserNotConfirmedException";
        throw err;
      })
    };

    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "secret" })
    ).rejects.toMatchObject({
      code: "COGNITO_OIDC_EMAIL_NOT_VERIFIED"
    });
  });

  it("rejects challenge-based responses without tokens", async () => {
    const client = new HttpCognitoOidcClient({ region: "us-east-1", clientId: "client123" });
    (client as any).client = {
      send: vi.fn(async () => ({
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: "sess"
      }))
    };

    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "secret" })
    ).rejects.toMatchObject({
      code: "COGNITO_OIDC_AUTH_CHALLENGE"
    });
  });

  it("returns access token and expiry on success", async () => {
    const sendMock = vi.fn(async () => ({
      AuthenticationResult: { AccessToken: "token-123", ExpiresIn: 3600 }
    }));
    const client = new HttpCognitoOidcClient({ region: "us-east-1", clientId: "client123" });
    (client as any).client = { send: sendMock };

    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "secret" })
    ).resolves.toEqual({
      accessToken: "token-123",
      expiresInSeconds: 3600
    });
  });
});

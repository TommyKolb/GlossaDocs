import { describe, expect, it, vi } from "vitest";

import {
  HttpCognitoOidcClient,
  CognitoOidcClientError,
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
  function createClient(send: ReturnType<typeof vi.fn>): HttpCognitoOidcClient {
    const cognitoClient = { send } as any;
    return new HttpCognitoOidcClient(
      { region: "us-east-1", clientId: "client123" },
      { cognitoClient }
    );
  }

  it("maps NotAuthorizedException to invalid credentials", async () => {
    const client = createClient(
      vi.fn(async () => {
        const err = new Error("not authorized");
        (err as Error & { name: string }).name = "NotAuthorizedException";
        throw err;
      })
    );

    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "wrong" })
    ).rejects.toMatchObject({
      code: "COGNITO_OIDC_INVALID_CREDENTIALS"
    });
  });

  it("maps UserNotConfirmedException to email not verified", async () => {
    const client = createClient(
      vi.fn(async () => {
        const err = new Error("not confirmed");
        (err as Error & { name: string }).name = "UserNotConfirmedException";
        throw err;
      })
    );

    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "secret" })
    ).rejects.toMatchObject({
      code: "COGNITO_OIDC_EMAIL_NOT_VERIFIED"
    });
  });

  it("rejects challenge-based responses without tokens", async () => {
    const client = createClient(
      vi.fn(async () => ({
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: "sess"
      }))
    );

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
    const client = createClient(sendMock);

    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "secret" })
    ).resolves.toEqual({
      accessToken: "token-123",
      expiresInSeconds: 3600
    });
  });

  it("maps UserNotFoundException to invalid credentials", async () => {
    const client = createClient(
      vi.fn(async () => {
        const err = new Error("missing user");
        (err as Error & { name: string }).name = "UserNotFoundException";
        throw err;
      })
    );
    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "wrong" })
    ).rejects.toMatchObject({
      code: "COGNITO_OIDC_INVALID_CREDENTIALS"
    });
  });

  it("maps unknown Cognito errors to unavailable", async () => {
    const client = createClient(
      vi.fn(async () => {
        const err = new Error("service unavailable");
        (err as Error & { name: string }).name = "InternalErrorException";
        throw err;
      })
    );
    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "secret" })
    ).rejects.toMatchObject({
      code: "COGNITO_OIDC_UNAVAILABLE",
      message: "Cognito login request failed"
    });
  });

  it("fails when token response is missing required fields", async () => {
    const client = createClient(
      vi.fn(async () => ({
        AuthenticationResult: { AccessToken: undefined, ExpiresIn: undefined }
      }))
    );
    await expect(
      client.loginWithPassword({ username: "alice@example.com", password: "secret" })
    ).rejects.toMatchObject({
      code: "COGNITO_OIDC_UNAVAILABLE"
    });
  });
});

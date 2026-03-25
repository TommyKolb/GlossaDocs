import { beforeEach, describe, expect, it, vi } from "vitest";

const { jwtVerify, createRemoteJWKSet } = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  createRemoteJWKSet: vi.fn(() => ({}))
}));

vi.mock("jose", () => ({
  createRemoteJWKSet,
  jwtVerify
}));

import { JoseTokenVerifier } from "../../src/modules/identity-access/jose-token-verifier.js";
import { ApiError } from "../../src/shared/api-error.js";

describe("JoseTokenVerifier", () => {
  beforeEach(() => {
    jwtVerify.mockReset();
    createRemoteJWKSet.mockClear();
  });

  it("maps jwtVerify payload to AuthenticatedPrincipal", async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: "actor-1",
        preferred_username: "alice",
        email: "alice@example.com",
        scope: "documents:read documents:write"
      }
    });

    const verifier = new JoseTokenVerifier({
      issuerUrl: "https://issuer.example",
      audience: "glossadocs",
      jwksUrl: "https://issuer.example/jwks"
    });

    const principal = await verifier.verify("token");

    expect(principal).toEqual({
      actorSub: "actor-1",
      username: "alice",
      email: "alice@example.com",
      scopes: ["documents:read", "documents:write"]
    });

    expect(jwtVerify).toHaveBeenCalledWith(
      "token",
      expect.anything(),
      expect.objectContaining({
        issuer: "https://issuer.example",
        audience: "glossadocs"
      })
    );
  });

  it("prefers preferred_username over name for username", async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: "s",
        preferred_username: "pref",
        name: "Full Name"
      }
    });

    const verifier = new JoseTokenVerifier({
      issuerUrl: "https://issuer",
      audience: "aud",
      jwksUrl: "https://issuer/jwks"
    });

    expect((await verifier.verify("t")).username).toBe("pref");
  });

  it("falls back to name when preferred_username missing", async () => {
    jwtVerify.mockResolvedValue({
      payload: { sub: "s", name: "Bob" }
    });

    const verifier = new JoseTokenVerifier({
      issuerUrl: "https://issuer",
      audience: "aud",
      jwksUrl: "https://issuer/jwks"
    });

    expect((await verifier.verify("t")).username).toBe("Bob");
  });

  it("throws AUTH_INVALID_SUB when subject claim is missing", async () => {
    jwtVerify.mockResolvedValue({
      payload: { preferred_username: "x" }
    });

    const verifier = new JoseTokenVerifier({
      issuerUrl: "https://issuer",
      audience: "aud",
      jwksUrl: "https://issuer/jwks"
    });

    await expect(verifier.verify("t")).rejects.toMatchObject({
      code: "AUTH_INVALID_SUB"
    });
  });

  it("rethrows ApiError from jwtVerify unchanged", async () => {
    jwtVerify.mockRejectedValue(new ApiError(401, "AUTH_EXPIRED", "expired"));

    const verifier = new JoseTokenVerifier({
      issuerUrl: "https://issuer",
      audience: "aud",
      jwksUrl: "https://issuer/jwks"
    });

    await expect(verifier.verify("t")).rejects.toMatchObject({ code: "AUTH_EXPIRED" });
  });

  it("wraps non-ApiError failures as AUTH_INVALID_TOKEN", async () => {
    jwtVerify.mockRejectedValue(new Error("bad sig"));

    const verifier = new JoseTokenVerifier({
      issuerUrl: "https://issuer",
      audience: "aud",
      jwksUrl: "https://issuer/jwks"
    });

    await expect(verifier.verify("t")).rejects.toMatchObject({
      code: "AUTH_INVALID_TOKEN"
    });
  });
});

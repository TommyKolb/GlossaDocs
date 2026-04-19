import { describe, expect, it, vi } from "vitest";

import { CognitoEmailEnrichingTokenVerifier } from "../../src/modules/identity-access/cognito-email-enriching-token-verifier.js";
import type { AuthenticatedPrincipal, TokenVerifier } from "../../src/modules/identity-access/token-verifier.js";

describe("CognitoEmailEnrichingTokenVerifier", () => {
  const basePrincipal: AuthenticatedPrincipal = {
    actorSub: "sub-1",
    username: "7438e448-3041-7089-9b8f-2bd62be5b6b4",
    email: null,
    scopes: []
  };

  it("returns inner principal unchanged when email is already present", async () => {
    const inner: TokenVerifier = {
      verify: vi.fn(async () => ({
        ...basePrincipal,
        email: "already@example.com"
      }))
    };
    const send = vi.fn().mockRejectedValue(new Error("should not be called"));
    const cognitoClient = { send } as any;

    const verifier = new CognitoEmailEnrichingTokenVerifier(inner, cognitoClient);
    const result = await verifier.verify("token");

    expect(result.email).toBe("already@example.com");
    expect(send).not.toHaveBeenCalled();
  });

  it("enriches email and username from GetUser when JWT had no email", async () => {
    const inner: TokenVerifier = {
      verify: vi.fn(async () => ({ ...basePrincipal }))
    };
    const send = vi.fn().mockResolvedValue({
      UserAttributes: [{ Name: "email", Value: "  user@example.com  " }]
    });
    const cognitoClient = { send } as any;

    const verifier = new CognitoEmailEnrichingTokenVerifier(inner, cognitoClient);
    const result = await verifier.verify("access-token");

    expect(result.email).toBe("user@example.com");
    expect(result.username).toBe("user@example.com");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps inner principal when GetUser fails", async () => {
    const inner: TokenVerifier = {
      verify: vi.fn(async () => ({ ...basePrincipal }))
    };
    const send = vi.fn().mockRejectedValue(new Error("network"));
    const cognitoClient = { send } as any;

    const verifier = new CognitoEmailEnrichingTokenVerifier(inner, cognitoClient);
    const result = await verifier.verify("access-token");

    expect(result).toEqual(basePrincipal);
  });

  it("keeps inner principal when GetUser returns no email attribute", async () => {
    const inner: TokenVerifier = {
      verify: vi.fn(async () => ({ ...basePrincipal }))
    };
    const send = vi.fn().mockResolvedValue({ UserAttributes: [] });
    const cognitoClient = { send } as any;

    const verifier = new CognitoEmailEnrichingTokenVerifier(inner, cognitoClient);
    const result = await verifier.verify("access-token");

    expect(result.email).toBeNull();
  });
});

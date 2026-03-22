import type { FastifyPluginAsync } from "fastify";

import type { AppConfig } from "../../shared/config.js";

interface AuthPublicRoutesOptions {
  config: Partial<AppConfig>;
}

function buildAuthorizeUrl(params: {
  issuerUrl: string;
  clientId: string;
  redirectUri: string;
  isRegistration: boolean;
}): string {
  const url = new URL(`${params.issuerUrl.replace(/\/+$/, "")}/protocol/openid-connect/auth`);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid");
  if (params.isRegistration) {
    url.searchParams.set("kc_action", "register");
  }
  return url.toString();
}

export const authPublicRoutes: FastifyPluginAsync<AuthPublicRoutesOptions> = async (
  app,
  options
) => {
  app.get("/auth/public", async () => {
    const issuerUrl = options.config.OIDC_PUBLIC_ISSUER_URL;
    const clientId = options.config.OIDC_PUBLIC_CLIENT_ID;
    const redirectUri = options.config.OIDC_PUBLIC_REDIRECT_URI;

    if (!issuerUrl || !clientId || !redirectUri) {
      return {
        issuerUrl: issuerUrl ?? null,
        clientId: clientId ?? null,
        redirectUri: redirectUri ?? null,
        loginUrl: null,
        registrationUrl: null
      };
    }

    return {
      issuerUrl,
      clientId,
      redirectUri,
      loginUrl: buildAuthorizeUrl({ issuerUrl, clientId, redirectUri, isRegistration: false }),
      registrationUrl: buildAuthorizeUrl({ issuerUrl, clientId, redirectUri, isRegistration: true })
    };
  });
};


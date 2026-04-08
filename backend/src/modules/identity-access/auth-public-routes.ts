import type { FastifyPluginAsync } from "fastify";

import type { AppConfig } from "../../shared/config.js";

interface AuthPublicRoutesOptions {
  config: Partial<AppConfig>;
}

function buildAuthUrl(params: {
  authProvider: "keycloak" | "cognito";
  issuerUrl: string;
  clientId: string;
  redirectUri: string;
  isRegistration: boolean;
  cognitoPublicDomain?: string;
}): string {
  if (params.authProvider === "cognito") {
    const cognitoDomain = params.cognitoPublicDomain?.replace(/\/+$/, "");
    if (!cognitoDomain) {
      return "";
    }
    const path = params.isRegistration ? "/signup" : "/login";
    const url = new URL(`${cognitoDomain}${path}`);
    url.searchParams.set("client_id", params.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    return url.toString();
  }

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
    const authProvider = options.config.AUTH_PROVIDER ?? "keycloak";
    const issuerUrl = options.config.OIDC_PUBLIC_ISSUER_URL;
    const clientId = options.config.OIDC_PUBLIC_CLIENT_ID;
    const redirectUri = options.config.OIDC_PUBLIC_REDIRECT_URI;
    const cognitoPublicDomain = options.config.COGNITO_PUBLIC_DOMAIN;

    if (!issuerUrl || !clientId || !redirectUri) {
      return {
        authProvider,
        issuerUrl: issuerUrl ?? null,
        clientId: clientId ?? null,
        redirectUri: redirectUri ?? null,
        loginUrl: null,
        registrationUrl: null
      };
    }

    const loginUrl = buildAuthUrl({
      authProvider,
      issuerUrl,
      clientId,
      redirectUri,
      isRegistration: false,
      cognitoPublicDomain
    });
    const registrationUrl = buildAuthUrl({
      authProvider,
      issuerUrl,
      clientId,
      redirectUri,
      isRegistration: true,
      cognitoPublicDomain
    });

    return {
      authProvider,
      issuerUrl,
      clientId,
      redirectUri,
      loginUrl: loginUrl || null,
      registrationUrl: registrationUrl || null
    };
  });
};


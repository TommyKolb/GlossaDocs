import type { AuthenticatedPrincipal } from "../modules/identity-access/token-verifier.js";
import type { AuthSessionStore } from "../modules/identity-access/auth-session-store.js";
import type { RequestContext } from "./request-context.js";

declare module "fastify" {
  interface FastifyInstance {
    authSessionStore: AuthSessionStore;
    authSessionCookieName: string;
  }

  interface FastifyRequest {
    requestContext: RequestContext | null;
    principal: AuthenticatedPrincipal | null;
  }
}

export {};

import type { AuthenticatedPrincipal } from "../modules/identity-access/token-verifier.js";
import type { RequestContext } from "./request-context.js";

declare module "fastify" {
  interface FastifyRequest {
    requestContext: RequestContext | null;
    principal: AuthenticatedPrincipal | null;
  }
}

export {};

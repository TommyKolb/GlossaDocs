import type { FastifyPluginAsync } from "fastify";

import { ApiError } from "../../shared/api-error.js";
import { requireAuth } from "./auth.js";
import type { TokenVerifier } from "./token-verifier.js";

interface MeRoutesOptions {
  tokenVerifier: TokenVerifier;
}

export const meRoutes: FastifyPluginAsync<MeRoutesOptions> = async (app, options) => {
  app.get(
    "/me",
    {
      preHandler: async (request, reply) => requireAuth(request, reply, options.tokenVerifier)
    },
    async (request) => {
      if (!request.principal) {
        throw new ApiError(401, "AUTH_MISSING_PRINCIPAL", "Authenticated principal was not resolved");
      }

      return {
        sub: request.principal.actorSub,
        username: request.principal.username,
        email: request.principal.email,
        scopes: request.principal.scopes
      };
    }
  );
};

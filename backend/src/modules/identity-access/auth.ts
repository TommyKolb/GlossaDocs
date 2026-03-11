import type { FastifyReply, FastifyRequest } from "fastify";

import { ApiError } from "../../shared/api-error.js";
import { createRequestContext } from "../../shared/request-context.js";
import type { TokenVerifier } from "./token-verifier.js";

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    throw new ApiError(401, "AUTH_MISSING_TOKEN", "Missing Authorization header");
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "AUTH_BAD_AUTHORIZATION", "Authorization header must use Bearer token");
  }

  return token;
}

export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
  tokenVerifier: TokenVerifier
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  const principal = await tokenVerifier.verify(token);

  request.principal = principal;
  request.requestContext = request.requestContext ?? createRequestContext(request);
  request.requestContext.actorSub = principal.actorSub;
  request.requestContext.scopes = principal.scopes;
}

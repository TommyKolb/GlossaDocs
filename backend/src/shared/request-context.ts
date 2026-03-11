import type { FastifyRequest } from "fastify";

export interface RequestContext {
  requestId: string;
  actorSub: string | null;
  scopes: string[];
}

export function createRequestContext(request: FastifyRequest): RequestContext {
  return {
    requestId: request.id,
    actorSub: null,
    scopes: []
  };
}

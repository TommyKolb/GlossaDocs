import { createHash } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

import type { AuditWriter } from "./audit-writer.js";

function shouldAuditMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function hashRequestBody(request: FastifyRequest): string | null {
  if (request.body === undefined || request.body === null) {
    return null;
  }

  const serialized = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
  return createHash("sha256").update(serialized).digest("hex");
}

export function registerAuditHook(app: FastifyInstance, auditWriter: AuditWriter): void {
  app.addHook("onResponse", async (request, reply) => {
    if (!shouldAuditMethod(request.method)) {
      return;
    }

    try {
      await auditWriter.write({
        requestId: request.id,
        actorSub: request.requestContext?.actorSub ?? null,
        route: request.routeOptions.url ?? request.url,
        method: request.method,
        statusCode: reply.statusCode,
        payloadHash: hashRequestBody(request)
      });
    } catch (error) {
      // Auditing failures are logged but do not break user-visible API behavior.
      request.log.error(error, "Failed to persist audit event");
    }
  });
}

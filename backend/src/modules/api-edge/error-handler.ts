import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { isApiError } from "../../shared/api-error.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (isApiError(error)) {
      void reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        requestId: request.id
      });
      return;
    }

    if (error instanceof ZodError) {
      void reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        requestId: request.id,
        details: error.issues
      });
      return;
    }

    request.log.error(error);
    void reply.status(500).send({
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
      requestId: request.id
    });
  });
}

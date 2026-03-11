import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { ApiError } from "../../shared/api-error.js";
import { SUPPORTED_DOCUMENT_LANGUAGES } from "../../shared/document-languages.js";
import { requireAuth } from "../identity-access/auth.js";
import { requireActorSub } from "../identity-access/current-actor.js";
import type { TokenVerifier } from "../identity-access/token-verifier.js";
import { DocumentService } from "./document-service.js";

const createDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  language: z.enum(SUPPORTED_DOCUMENT_LANGUAGES)
});

const updateDocumentSchema = z
  .object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    language: z.enum(SUPPORTED_DOCUMENT_LANGUAGES).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update"
  });

const paramsSchema = z.object({
  id: z.string().uuid()
});

interface DocumentRoutesOptions {
  tokenVerifier: TokenVerifier;
  service: DocumentService;
}

export const documentRoutes: FastifyPluginAsync<DocumentRoutesOptions> = async (app, options) => {
  app.get(
    "/documents",
    { preHandler: async (req, reply) => requireAuth(req, reply, options.tokenVerifier) },
    async (request) => {
      const actorSub = requireActorSub(request);
      return options.service.listByOwner(actorSub);
    }
  );

  app.get(
    "/documents/:id",
    { preHandler: async (req, reply) => requireAuth(req, reply, options.tokenVerifier) },
    async (request, reply) => {
      const actorSub = requireActorSub(request);
      const { id } = paramsSchema.parse(request.params);
      const doc = await options.service.getOwned(actorSub, id);

      if (!doc) {
        throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found");
      }

      return reply.send(doc);
    }
  );

  app.post(
    "/documents",
    { preHandler: async (req, reply) => requireAuth(req, reply, options.tokenVerifier) },
    async (request, reply) => {
      const actorSub = requireActorSub(request);
      const payload = createDocumentSchema.parse(request.body);
      const created = await options.service.createOwned(actorSub, payload);
      return reply.status(201).send(created);
    }
  );

  app.put(
    "/documents/:id",
    { preHandler: async (req, reply) => requireAuth(req, reply, options.tokenVerifier) },
    async (request, reply) => {
      const actorSub = requireActorSub(request);
      const { id } = paramsSchema.parse(request.params);
      const patch = updateDocumentSchema.parse(request.body);
      const updated = await options.service.updateOwned(actorSub, id, patch);

      if (!updated) {
        throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found");
      }

      return reply.send(updated);
    }
  );

  app.delete(
    "/documents/:id",
    { preHandler: async (req, reply) => requireAuth(req, reply, options.tokenVerifier) },
    async (request, reply) => {
      const actorSub = requireActorSub(request);
      const { id } = paramsSchema.parse(request.params);
      const deleted = await options.service.deleteOwned(actorSub, id);

      if (!deleted) {
        throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found");
      }

      return reply.status(204).send();
    }
  );
};

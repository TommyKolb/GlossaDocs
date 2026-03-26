import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { requireAuth } from "../identity-access/auth.js";
import { requireActorSub } from "../identity-access/current-actor.js";
import type { TokenVerifier } from "../identity-access/token-verifier.js";
import { keyboardLayoutOverridesSchema } from "./keyboard-layout-overrides-schema.js";
import { SettingsService } from "./settings-service.js";

const updateSettingsSchema = z
  .object({
    lastUsedLocale: z.string().min(2).optional(),
    keyboardVisible: z.boolean().optional(),
    keyboardLayoutOverrides: keyboardLayoutOverridesSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update"
  });

interface SettingsRoutesOptions {
  tokenVerifier: TokenVerifier;
  service: SettingsService;
}

export const settingsRoutes: FastifyPluginAsync<SettingsRoutesOptions> = async (app, options) => {
  app.get(
    "/settings",
    { preHandler: async (req, reply) => requireAuth(req, reply, options.tokenVerifier) },
    async (request) => {
      const actorSub = requireActorSub(request);
      return options.service.getByOwner(actorSub);
    }
  );

  app.put(
    "/settings",
    { preHandler: async (req, reply) => requireAuth(req, reply, options.tokenVerifier) },
    async (request) => {
      const actorSub = requireActorSub(request);
      const patch = updateSettingsSchema.parse(request.body);
      return options.service.updateByOwner(actorSub, patch);
    }
  );
};

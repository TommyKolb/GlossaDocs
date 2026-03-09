import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import type { AppConfig } from "./shared/config.js";
import { healthRoutes } from "./modules/api-edge/health-routes.js";

export function buildApp(config: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: config.NODE_ENV !== "test"
  });

  void app.register(cors, {
    origin: config.CORS_ALLOWED_ORIGINS === "*" ? true : config.CORS_ALLOWED_ORIGINS
  });

  void app.register(healthRoutes);

  return app;
}

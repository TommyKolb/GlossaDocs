import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    return { status: "ok" } as const;
  });

  app.get("/ready", async () => {
    // Readiness can later include DB and JWKS checks.
    return { status: "ready" } as const;
  });
};

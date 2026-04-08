import type { FastifyPluginAsync } from "fastify";

import { queryDb } from "../../shared/db.js";

interface HealthRoutesOptions {
  databaseUrl?: string;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, options) => {
  app.get("/health", async () => {
    return { status: "ok" } as const;
  });

  app.get("/ready", async (_request, reply) => {
    const checks: Array<{ dependency: string; ok: boolean; message?: string }> = [];

    if (options.databaseUrl) {
      try {
        await queryDb(options.databaseUrl, "select 1 as ok");
        checks.push({ dependency: "postgres", ok: true });
      } catch (error) {
        checks.push({
          dependency: "postgres",
          ok: false,
          message: error instanceof Error ? error.message : "Database check failed"
        });
      }
    } else {
      checks.push({ dependency: "postgres", ok: true, message: "skipped (no DATABASE_URL configured)" });
    }

    if (typeof app.authSessionStore.healthCheck === "function") {
      try {
        await app.authSessionStore.healthCheck();
        checks.push({ dependency: "auth_session_store", ok: true });
      } catch (error) {
        checks.push({
          dependency: "auth_session_store",
          ok: false,
          message: error instanceof Error ? error.message : "Session store check failed"
        });
      }
    } else {
      checks.push({ dependency: "auth_session_store", ok: true, message: "skipped (no healthCheck hook)" });
    }

    const hasFailure = checks.some((check) => !check.ok);
    if (hasFailure) {
      return reply.status(503).send({
        status: "not_ready",
        checks
      } as const);
    }
    return {
      status: "ready",
      checks
    } as const;
  });
};

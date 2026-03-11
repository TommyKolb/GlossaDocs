import { queryDb } from "../../shared/db.js";
import type { AuditEvent, AuditWriter } from "./audit-writer.js";

export class PgAuditWriter implements AuditWriter {
  private readonly databaseUrl: string;

  public constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
  }

  public async write(event: AuditEvent): Promise<void> {
    await queryDb(
      this.databaseUrl,
      `insert into api_audit_events (
        request_id,
        actor_sub,
        route,
        method,
        status_code,
        payload_hash,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, now())`,
      [
        event.requestId,
        event.actorSub,
        event.route,
        event.method,
        event.statusCode,
        event.payloadHash
      ]
    );
  }
}

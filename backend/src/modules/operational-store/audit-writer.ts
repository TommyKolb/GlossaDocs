export interface AuditEvent {
  requestId: string;
  actorSub: string | null;
  route: string;
  method: string;
  statusCode: number;
  payloadHash: string | null;
}

export interface AuditWriter {
  write(event: AuditEvent): Promise<void>;
}

export class NoopAuditWriter implements AuditWriter {
  public async write(_event: AuditEvent): Promise<void> {
    // Intentionally no-op in tests/local-only flows where persistence is injected later.
  }
}

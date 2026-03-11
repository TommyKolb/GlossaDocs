import type { AuditEvent, AuditWriter } from "../../src/modules/operational-store/audit-writer.js";

export class TestAuditWriter implements AuditWriter {
  private readonly eventsInternal: AuditEvent[] = [];

  public async write(event: AuditEvent): Promise<void> {
    this.eventsInternal.push(event);
  }

  public events(): AuditEvent[] {
    return [...this.eventsInternal];
  }
}

/* eslint-disable camelcase */

/**
 * Durable audit log for mutating API requests.
 */
export const up = (pgm) => {
  pgm.createTable("api_audit_events", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    request_id: {
      type: "text"
    },
    actor_sub: {
      type: "text"
    },
    route: {
      type: "text",
      notNull: true
    },
    method: {
      type: "text",
      notNull: true
    },
    status_code: {
      type: "integer",
      notNull: true
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    payload_hash: {
      type: "text"
    }
  });

  pgm.createIndex("api_audit_events", ["created_at"], {
    name: "idx_api_audit_events_created_at"
  });
};

export const down = (pgm) => {
  pgm.dropTable("api_audit_events");
};

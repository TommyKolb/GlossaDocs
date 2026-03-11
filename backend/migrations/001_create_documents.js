/* eslint-disable camelcase */

/**
 * Documents are the core domain table for Story 1.
 * We enforce owner scoping and document ordering at the DB level.
 */
export const up = (pgm) => {
  pgm.createTable("documents", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    owner_id: {
      type: "text",
      notNull: true
    },
    title: {
      type: "text",
      notNull: true
    },
    content: {
      type: "text",
      notNull: true
    },
    language: {
      type: "text",
      notNull: true
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  // Historical migration: keep this explicit and immutable.
  // When adding a new language later, add a new migration that alters this constraint.
  pgm.addConstraint("documents", "documents_language_check", {
    check: "language in ('en','de','ru')"
  });

  pgm.createIndex("documents", ["owner_id", "updated_at"], {
    name: "idx_documents_owner_updated"
  });

  pgm.createIndex("documents", ["id", "owner_id"], {
    name: "idx_documents_id_owner"
  });
};

export const down = (pgm) => {
  pgm.dropTable("documents");
};

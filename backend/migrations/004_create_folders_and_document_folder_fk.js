/* eslint-disable camelcase */

/**
 * Adds nested folders and optional folder assignment for documents.
 */
export const up = (pgm) => {
  pgm.createTable("folders", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    owner_id: {
      type: "text",
      notNull: true
    },
    name: {
      type: "text",
      notNull: true
    },
    parent_folder_id: {
      type: "uuid"
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

  pgm.addConstraint("folders", "fk_folders_parent_folder_id", {
    foreignKeys: {
      columns: "parent_folder_id",
      references: "folders(id)",
      onDelete: "set null"
    }
  });

  pgm.createIndex("folders", ["owner_id", "parent_folder_id"], {
    name: "idx_folders_owner_parent"
  });
  pgm.createIndex("folders", ["owner_id", "updated_at"], {
    name: "idx_folders_owner_updated"
  });

  pgm.addColumn("documents", {
    folder_id: {
      type: "uuid"
    }
  });
  pgm.addConstraint("documents", "fk_documents_folder_id", {
    foreignKeys: {
      columns: "folder_id",
      references: "folders(id)",
      onDelete: "set null"
    }
  });
  pgm.createIndex("documents", ["owner_id", "folder_id"], {
    name: "idx_documents_owner_folder"
  });
};

export const down = (pgm) => {
  pgm.dropIndex("documents", ["owner_id", "folder_id"], {
    name: "idx_documents_owner_folder"
  });
  pgm.dropConstraint("documents", "fk_documents_folder_id");
  pgm.dropColumns("documents", ["folder_id"]);

  pgm.dropIndex("folders", ["owner_id", "updated_at"], {
    name: "idx_folders_owner_updated"
  });
  pgm.dropIndex("folders", ["owner_id", "parent_folder_id"], {
    name: "idx_folders_owner_parent"
  });
  pgm.dropConstraint("folders", "fk_folders_parent_folder_id");
  pgm.dropTable("folders");
};

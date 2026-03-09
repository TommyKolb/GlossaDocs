/* eslint-disable camelcase */

/**
 * User settings supports Story 3 preference persistence.
 * One row per authenticated actor (owner_id).
 */
export const up = (pgm) => {
  pgm.createTable("user_settings", {
    owner_id: {
      type: "text",
      primaryKey: true
    },
    last_used_locale: {
      type: "text",
      notNull: true,
      default: "en-US"
    },
    keyboard_visible: {
      type: "boolean",
      notNull: true,
      default: true
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });
};

export const down = (pgm) => {
  pgm.dropTable("user_settings");
};

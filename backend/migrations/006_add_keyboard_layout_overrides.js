/* eslint-disable camelcase */

/**
 * Per-user overrides for on-screen keyboard / physical-key remapping (JSON object keyed by language code).
 */
export const up = (pgm) => {
  pgm.addColumn("user_settings", {
    keyboard_layout_overrides: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb")
    }
  });
};

export const down = (pgm) => {
  pgm.dropColumn("user_settings", "keyboard_layout_overrides");
};

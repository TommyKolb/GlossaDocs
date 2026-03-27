/* eslint-disable camelcase */

/**
 * Adds per-document font family metadata used by editor themes.
 */
export const up = (pgm) => {
  pgm.addColumn("documents", {
    font_family: {
      type: "text"
    }
  });
};

export const down = (pgm) => {
  pgm.dropColumns("documents", ["font_family"]);
};

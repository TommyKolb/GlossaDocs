/**
 * Required for gen_random_uuid() defaults in core tables.
 */
export const up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });
};

export const down = (pgm) => {
  pgm.dropExtension("pgcrypto", { ifExists: true });
};

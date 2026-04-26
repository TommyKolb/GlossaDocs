/* eslint-disable camelcase */

/**
 * Extend documents.language check for Spanish and French (see shared document-languages).
 */
export const up = (pgm) => {
  pgm.dropConstraint("documents", "documents_language_check");
  pgm.addConstraint("documents", "documents_language_check", {
    check: "language in ('en','de','ru','es','fr')"
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("documents", "documents_language_check");
  pgm.addConstraint("documents", "documents_language_check", {
    check: "language in ('en','de','ru')"
  });
};

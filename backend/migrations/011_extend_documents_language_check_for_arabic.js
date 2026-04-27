/* eslint-disable camelcase */

/**
 * Extend documents.language check for Arabic (Modern Standard Arabic, `ar`).
 */
export const up = (pgm) => {
  pgm.dropConstraint("documents", "documents_language_check");
  pgm.addConstraint("documents", "documents_language_check", {
    check: "language in ('en','de','ru','es','fr','it','pt','nl','pl','uk','id','sw','tl','ar','zh-Hans','zh-Hant')"
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("documents", "documents_language_check");
  pgm.addConstraint("documents", "documents_language_check", {
    check: "language in ('en','de','ru','es','fr','it','pt','nl','pl','uk','id','sw','tl','zh-Hans','zh-Hant')"
  });
};

/* eslint-disable camelcase */

/**
 * Extend documents.language check for Swedish (sv), Norwegian Bokmål (nb), and Turkish (tr).
 */
export const up = (pgm) => {
  pgm.dropConstraint("documents", "documents_language_check");
  pgm.addConstraint("documents", "documents_language_check", {
    check:
      "language in ('en','de','ru','es','fr','it','pt','nl','pl','uk','sv','nb','tr','id','sw','tl','ar','zh-Hans','zh-Hant')"
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("documents", "documents_language_check");
  pgm.addConstraint("documents", "documents_language_check", {
    check:
      "language in ('en','de','ru','es','fr','it','pt','nl','pl','uk','id','sw','tl','ar','zh-Hans','zh-Hant')"
  });
};

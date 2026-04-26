import { z } from "zod";

import { SUPPORTED_DOCUMENT_LANGUAGES } from "../../shared/document-languages.js";

/** Single output character and physical key label (shared with PG normalization). */
export const keyboardLayoutOutputKeySchema = z.string().min(1).max(8);
export const keyboardLayoutTypedWithSchema = z.string().min(1).max(16);

/** Per language: alphabet letter (output) → physical key label (`typedWith`). */
export const perLanguageKeyboardOverridesSchema = z.record(
  keyboardLayoutOutputKeySchema,
  keyboardLayoutTypedWithSchema
);

const optionalPerLanguage = perLanguageKeyboardOverridesSchema.optional();

const keyboardLayoutOverridesShape = Object.fromEntries(
  SUPPORTED_DOCUMENT_LANGUAGES.map((lang) => [lang, optionalPerLanguage])
) as {
  [K in (typeof SUPPORTED_DOCUMENT_LANGUAGES)[number]]: typeof optionalPerLanguage;
};

export const keyboardLayoutOverridesSchema = z.object(keyboardLayoutOverridesShape).strict();

export type KeyboardLayoutOverrides = z.infer<typeof keyboardLayoutOverridesSchema>;

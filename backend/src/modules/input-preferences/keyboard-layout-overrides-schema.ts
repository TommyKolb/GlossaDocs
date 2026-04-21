import { z } from "zod";

/** Single output character and physical key label (shared with PG normalization). */
export const keyboardLayoutOutputKeySchema = z.string().min(1).max(8);
export const keyboardLayoutTypedWithSchema = z.string().min(1).max(16);

/** Per language: alphabet letter (output) → physical key label (`typedWith`). */
export const perLanguageKeyboardOverridesSchema = z.record(
  keyboardLayoutOutputKeySchema,
  keyboardLayoutTypedWithSchema
);

export const keyboardLayoutOverridesSchema = z
  .object({
    en: perLanguageKeyboardOverridesSchema.optional(),
    de: perLanguageKeyboardOverridesSchema.optional(),
    ru: perLanguageKeyboardOverridesSchema.optional(),
    es: perLanguageKeyboardOverridesSchema.optional(),
    fr: perLanguageKeyboardOverridesSchema.optional()
  })
  .strict();

export type KeyboardLayoutOverrides = z.infer<typeof keyboardLayoutOverridesSchema>;

import { z } from "zod";

/** Per language: alphabet letter (output) → physical key label (`typedWith`). */
const perLanguageSchema = z.record(z.string().min(1).max(8), z.string().min(1).max(16));

export const keyboardLayoutOverridesSchema = z
  .object({
    en: perLanguageSchema.optional(),
    de: perLanguageSchema.optional(),
    ru: perLanguageSchema.optional()
  })
  .strict();

export type KeyboardLayoutOverrides = z.infer<typeof keyboardLayoutOverridesSchema>;

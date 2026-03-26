import { z } from "zod";

const keyOverrideSchema = z.object({
  output: z.string().min(1).max(32),
  shiftOutput: z.string().min(1).max(32).optional()
});

const perLanguageSchema = z.record(z.string().min(1).max(16), keyOverrideSchema);

export const keyboardLayoutOverridesSchema = z
  .object({
    en: perLanguageSchema.optional(),
    de: perLanguageSchema.optional(),
    ru: perLanguageSchema.optional()
  })
  .strict();

export type KeyboardLayoutOverrides = z.infer<typeof keyboardLayoutOverridesSchema>;

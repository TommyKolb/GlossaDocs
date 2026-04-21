# Adding a new language (contributor checklist)

Use this checklist so fonts, keyboard defaults, locale mapping, and tests stay aligned when you add or extend a language in GlossaDocs.

1. **Language code** — Add or update the entry in `src/app/utils/languages.ts` (`LANGUAGES` / `Language` union).

2. **Fonts** — Add a catalog entry in `src/app/utils/language-fonts.ts` (`defaultFamily`, `fonts[]` with `family`, `googleFontFamily`, `fallbackStack`). Mirror allowed families in `backend/src/shared/document-fonts.ts`.

3. **Locale ↔ language** — Extend `LANGUAGE_TO_LOCALE` and `LOCALE_PREFIX_TO_LANGUAGE` in `src/app/data/settings-repository.ts` so `lastUsedLocale` and new documents resolve to the new `Language`. If the backend validates document language codes, update the documents language check / constraints there too (see existing migrations and shared language lists).

4. **On-screen keyboard defaults** — Register a built-in layout in `src/app/utils/keyboardLayouts.ts`: define a `KeyboardLayout` constant and add it to `LANGUAGE_KEYBOARD_LAYOUTS`. Each key has fixed `output` (the letter shown) and default `typedWith` (physical key). Add at least one unit test in `src/test/unit/keyboard-layouts.test.ts` for that layout. Extend `backend/src/modules/input-preferences/keyboard-layout-overrides-schema.ts` so `keyboardLayoutOverrides` includes the new language code at the top level (`en` / `de` / `ru` / …).

5. **User keyboard overrides** — Persisted as JSON: per language, **output letter → physical key** (`typedWith`). No separate “shift” mapping; Shift still uses `toUpperCase()` of the letter. No extra DB migration when adding a language—only the Zod allowlist and built-in layout.

6. **Tests** — Update or add:

   - `src/test/integration/editor-fonts.test.tsx` (font catalog coverage)
   - `backend/test/integration/document-routes.test.ts` / `backend/test/unit/document-service.test.ts` if document language validation changes

See also [docs/testing.md](../testing.md) for how to run the test suites.

# Adding a new language (contributor checklist)

Use this checklist so fonts, keyboard defaults, locale mapping, and tests stay aligned when you add or extend a language in GlossaDocs. **Keep the frontend** (`src/app/utils/languages.ts`) **and backend** (`backend/src/shared/document-languages.ts`) **language code lists in sync;** `npm test` at the repo root runs a language-code parity check (`scripts/check-language-codes.mjs`) alongside the font catalog check.

1. **Language code** — Add or update the entry in `src/app/utils/languages.ts` (`LANGUAGES` / `Language` union).

2. **Fonts** — Add a catalog entry in `src/app/utils/language-fonts.ts` (`defaultFamily`, `fonts[]` with `family`, `googleFontFamily`, `fallbackStack`). Mirror allowed families in `backend/src/shared/document-fonts.ts`.

3. **Locale ↔ language** — Extend `LANGUAGE_TO_LOCALE` and `LOCALE_PREFIX_TO_LANGUAGE` in `src/app/data/settings-repository.ts` so `lastUsedLocale` and new documents resolve to the new `Language`. If the backend validates document language codes, update the documents language check / constraints there too (see existing migrations and shared language lists).

4. **Input defaults** — For alphabet-style languages, register a built-in layout in `src/app/utils/keyboardLayouts.ts`: define a `KeyboardLayout` constant and add it to `LANGUAGE_KEYBOARD_LAYOUTS`. Each key has fixed `output` (the letter shown) and default `typedWith` (physical key). Add at least one unit test in `src/test/unit/keyboard-layouts.test.ts` for that layout. For composition-style input such as Simplified / Traditional Chinese pinyin, do **not** force the language into `LANGUAGE_KEYBOARD_LAYOUTS`; add a dedicated input component and candidate utility instead. The current Chinese helper is a starter learner dictionary, not a full IME, so UI and docs must avoid claiming unrestricted Chinese typing. Add the new code to `SUPPORTED_DOCUMENT_LANGUAGES` in `backend/src/shared/document-languages.ts`; the Zod schema in `keyboard-layout-overrides-schema.ts` builds its strict top-level keys from that list—no separate hand-edit of the Zod key list. Also add a matching migration to extend `documents_language_check` if the new code is not already allowed by the latest constraint.

5. **User keyboard overrides** — Persisted as JSON: per alphabet-style language, **output character → physical key** (`typedWith`). There is no separate persisted “shift” map: for Latin/Cyrillic-style layouts, Shift + key uses `toUpperCase()` of the mapped output when the built-in key has no explicit `shiftOutput`. **Arabic is different:** the built-in layout uses explicit `shiftOutput` per key (harakat and punctuation, not letter case); overrides must only change `typedWith`—the implementation preserves `shiftOutput` from the built-in key so remapping does not break the Shift layer. Composition-style input (Chinese pinyin) does not use these physical-key overrides. No extra DB migration when adding a language—only the Zod allowlist and built-in layout/input behavior.

6. **Tests** — Update or add:

   - `src/test/integration/editor-fonts.test.tsx` (font catalog coverage)
   - `src/test/unit/keyboard-layouts.test.ts` for alphabet-style on-screen layouts
   - `src/test/unit/chinese-pinyin.test.ts`, `src/test/integration/language-keyboard.test.tsx`, and `src/test/integration/editor-keyboard-mapping.test.tsx` for composition-style pinyin input
   - `backend/test/integration/document-routes.test.ts` / `backend/test/unit/document-service.test.ts` if document language validation changes

See also [docs/testing.md](../testing.md) for how to run the test suites.

## Arabic layout and on-screen keyboard

The built-in Arabic map matches a common Windows Arabic (101) logical layout. **On-screen keys** insert the unshifted `output` only; the Shift layer (harakat, extra punctuation) is available when typing with the physical keyboard and key remapping, not as separate on-screen buttons—see `LanguageKeyboard` and `getRemappedCharacter` in `src/app/utils/keyboardLayouts.ts`. Documents in Arabic use a right-to-left **editor** surface (`dir="rtl"`) via `isRTLLanguage` in `src/app/utils/languages.ts`.

## Chinese pinyin input caveat

Simplified (`zh-Hans`) and Traditional (`zh-Hant`) Chinese use a separate pinyin candidate panel instead of fixed key remapping. Candidate data is generated from CC-CEDICT into `src/app/data/chinese-pinyin-dictionary.generated.ts`; lookup behavior lives in `src/app/utils/chinesePinyin.ts`.

CC-CEDICT is licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). If you regenerate or modify this dictionary-derived data, preserve attribution and review share-alike obligations before shipping. Keep the repo-level notice in `THIRD_PARTY_NOTICES.md` aligned with the generated data source and transformation.

The generated dictionary is committed so normal installs and production builds do not depend on downloading CC-CEDICT. Run `npm run generate:chinese-pinyin` only when refreshing the source data or changing the generation heuristics, then review the generator changes more carefully than the large generated diff. The generator caps candidates per pinyin key and uses lightweight heuristics; it is broader than a hand-written starter list, but it is still not a complete Mandarin IME. A production-grade IME needs stronger segmentation for multi-syllable input, frequency/context candidate ranking, punctuation behavior, and ideally user learning. Installed OS/browser Chinese input methods should continue to work through native composition events and remain the fallback for unrestricted Chinese typing.

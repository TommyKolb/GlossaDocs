# Test specification: `keyboardLayouts.ts`

**Source:** `src/app/utils/keyboardLayouts.ts`  
**Automated tests:** `src/test/unit/keyboard-layouts.test.ts`

This module defines per-language on-screen keyboard layouts and maps physical key events (`key`, Shift, Caps Lock) to the character that should be inserted for Russian phonetic, German, and English layouts. Built-in layouts live in a single `Language` → layout registry; optional **user overrides** (per physical key) are merged for display and remapping.

## Functions in this file

### Exported (public API)

| Function | Summary |
| -------- | ------- |
| `getDefaultKeyboardLayout(language)` | Returns the built-in three-row `KeyboardLayout` for `en`, `de`, or `ru` (no user overrides). |
| `getKeyboardLayout(language, overrides?)` | Returns the effective layout: defaults merged with optional `KeyboardLayoutOverrides` for that language. |
| `mergeKeyboardLayoutWithOverrides(layout, overrides)` | Immutable merge: override map keys match `typedWith` case-insensitively; unknown override keys are ignored. |
| `diffKeyboardLayoutAgainstLanguageDefaults(language, effective)` | Produces the minimal per-key override map for one language when compared to `getDefaultKeyboardLayout` (for persisting edits). |
| `getRemappedCharacter({ language, key, shiftKey, capsLock, keyboardLayoutOverrides? })` | Returns the character to insert, or `null` if the key is not a single character or has no mapping. Uses the effective layout (defaults + overrides). |

### Internal (not exported; used to build layouts and remaps)

| Function | Summary |
| -------- | ------- |
| `key(output, typedWith, shiftOutput?)` | Builds one `KeyboardKey` (base output, physical `typedWith`, optional `shiftOutput`). |
| `shouldUseShiftedCharacter(shiftKey, capsLock)` | Returns whether the shift layer is active (`shiftKey !== capsLock`). |
| `buildRemapTable(layout)` | Flattens layout rows into a map from `typedWith.toLowerCase()` to `{ output, shiftOutput }`, with `shiftOutput` defaulting to `output.toUpperCase()` when omitted. |

---

## Test table

| Purpose | Function(s) under test | Test inputs | Expected result if the test passes |
| ------- | ------------------------ | ----------- | ----------------------------------- |
| English layout has three rows and a known first row. | `getKeyboardLayout`, `key` (via static layout data) | `language: "en"`. | Length 3; first row outputs concatenate to `"qwertyuiop"`. |
| German layout exposes umlaut and eszett keys. | `getKeyboardLayout`, `key` | `language: "de"`. | Flattened outputs include `"ü"` and `"ß"`. |
| Russian layout uses Latin `typedWith` labels with Cyrillic `output`. | `getKeyboardLayout`, `key` | `language: "ru"`; find key with `typedWith === "j"`. | That key’s `output` is `"й"`. |
| Non–single-character `key` does not remap. | `getRemappedCharacter` | `language: "en"`, `key: "ArrowLeft"`, `shiftKey: false`, `capsLock: false`. | `null`. |
| Unmapped physical keys return null. | `getRemappedCharacter`, `buildRemapTable` | `language: "en"`, `key` is the grave accent / backtick character (not present on the English layout), `shiftKey` and `capsLock` false. | `null`. |
| Russian phonetic: `j` → `й` with no shift. | `getRemappedCharacter`, `buildRemapTable` | `language: "ru"`, `key: "j"`, `shiftKey: false`, `capsLock: false`. | `"й"`. |
| Shift selects uppercase Latin on English `q`. | `getRemappedCharacter`, `shouldUseShiftedCharacter`, `buildRemapTable` | `language: "en"`, `key: "q"`, `shiftKey: true`, `capsLock: false`. | `"Q"` (via default `shiftOutput`). |
| Caps Lock alone acts like shift for base letters. | `getRemappedCharacter`, `shouldUseShiftedCharacter` | `language: "en"`, `key: "q"`, `shiftKey: false`, `capsLock: true`. | `"Q"`. |
| Shift + Caps Lock cancel for base letters. | `getRemappedCharacter`, `shouldUseShiftedCharacter` | `language: "en"`, `key: "q"`, `shiftKey: true`, `capsLock: true`. | `"q"`. |
| German `[` maps to `ü` on the default layer. | `getRemappedCharacter`, `buildRemapTable` | `language: "de"`, `key: "["`, `shiftKey: false`, `capsLock: false`. | `"ü"`. |
| Physical key string is matched case-insensitively against remap keys built with lowercase `typedWith`. | `getRemappedCharacter`, `buildRemapTable` | `language: "en"`, `key: "Q"` (uppercase), `shiftKey: false`, `capsLock: false`. | `"q"`. |
| User overrides change merged layout and remapping consistently. | `getKeyboardLayout`, `getRemappedCharacter` | `language: "ru"`, overrides `{ ru: { j: { output: "х" } } }`. | Layout key `typedWith === "j"` has `output` `"х"`; `getRemappedCharacter` for `j` returns `"х"`. |
| Shift layer for overridden output defaults to uppercase of new output when `shiftOutput` omitted. | `getRemappedCharacter` | Same overrides, `key: "j"`, `shiftKey: true`. | `"Х"` (Cyrillic uppercase). |
| Override keys not on the built-in layout are ignored. | `getKeyboardLayout`, `getRemappedCharacter` | `language: "en"`, overrides include `` ` `` → `"~"``. | No effect; `` ` `` still unmapped. |
| Empty / other-language overrides do not change a language’s layout. | `getKeyboardLayout`, `getDefaultKeyboardLayout` | `getKeyboardLayout("ru", {})` and with only `{ en: … }` overrides. | Same as `getDefaultKeyboardLayout("ru")`. |
| `mergeKeyboardLayoutWithOverrides` normalizes override keys to lowercase. | `mergeKeyboardLayoutWithOverrides` | Override key `J` for English. | `j` row output updated. |
| `diffKeyboardLayoutAgainstLanguageDefaults` is empty when layouts match defaults. | `diffKeyboardLayoutAgainstLanguageDefaults` | Effective layout equals `getDefaultKeyboardLayout("en")`. | `{}`. |
| `diffKeyboardLayoutAgainstLanguageDefaults` records differing keys only. | `diffKeyboardLayoutAgainstLanguageDefaults` | Effective layout from `getKeyboardLayout("ru", { ru: { j: { output: "х" } } })`. | `{ j: { output: "х" } }`. |

---

## Coverage note

Internal helpers **`key`**, **`shouldUseShiftedCharacter`**, and **`buildRemapTable`** do not have separate imports; they are covered by the **`getKeyboardLayout`** and **`getRemappedCharacter`** tests above. The default branch `shiftOutput ?? output.toUpperCase()` in `buildRemapTable` is exercised by English shifted letters and by overridden Russian keys.

**UI integration:** `src/test/integration/language-keyboard.test.tsx` checks that overridden outputs appear on on-screen key buttons and in the customize dialog.

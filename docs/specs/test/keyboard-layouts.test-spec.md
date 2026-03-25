# Test specification: `keyboardLayouts.ts`

**Source:** `src/app/utils/keyboardLayouts.ts`  
**Automated tests:** `src/test/unit/keyboard-layouts.test.ts`

This module defines per-language on-screen keyboard layouts and maps physical key events (`key`, Shift, Caps Lock) to the character that should be inserted for Russian phonetic, German, and English layouts.

## Functions in this file

### Exported (public API)

| Function | Summary |
| -------- | ------- |
| `getKeyboardLayout(language)` | Returns the three-row `KeyboardLayout` for `en`, `de`, or `ru`. |
| `getRemappedCharacter({ language, key, shiftKey, capsLock })` | Returns the character to insert, or `null` if the key is not a single character or has no mapping. |

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

---

## Coverage note

Every **exported** function has multiple tests. Internal helpers **`key`**, **`shouldUseShiftedCharacter`**, and **`buildRemapTable`** do not have separate imports; they are covered by the **`getKeyboardLayout`** and **`getRemappedCharacter`** tests above (layout structure, shift/caps behavior, German and Russian mappings, and case-insensitive key lookup). No layout entry currently sets an explicit `shiftOutput` on `key()`; the default branch `shiftOutput ?? output.toUpperCase()` in `buildRemapTable` is exercised by English shifted letters.

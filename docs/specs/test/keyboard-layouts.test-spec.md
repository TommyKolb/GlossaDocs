# Test specification: `keyboardLayouts.ts`

**Source:** `src/app/utils/keyboardLayouts.ts`  
**Automated tests:** `src/test/unit/keyboard-layouts.test.ts`

This module defines per-language on-screen keyboard layouts and maps physical key events (`key`, Shift, Caps Lock) to the character that should be inserted (English, German, Russian, Spanish, French, and future languages registered in `languages.ts`). Built-in layouts live in a single `Language` → layout registry. Optional **user overrides** are stored as **alphabet letter (output) → physical key (`typedWith`)**; on-screen letters stay fixed, only which key you type with changes. Shift still uses `output.toUpperCase()` for the shifted character (no separate user “shift mapping”).

## Functions in this file

### Exported (public API)

| Function | Summary |
| -------- | ------- |
| `getDefaultKeyboardLayout(language)` | Returns the built-in `KeyboardLayout` for the given `Language` (no user overrides). |
| `getKeyboardLayout(language, overrides?)` | Returns the effective layout: defaults merged with optional `KeyboardLayoutOverrides` for that language. |
| `applyOutputToTypedWithOverrides(layout, overrides)` | For each key, if `overrides[key.output]` is set, replace `typedWith`; unknown output keys in the map are ignored. |
| `diffKeyboardLayoutAgainstLanguageDefaults(language, effective)` | Produces **output → typedWith** entries that differ from the built-in layout (for persistence). |
| `getDuplicatePhysicalKeyError(layout)` | If two letters share the same physical key, returns an error string; otherwise `null`. |
| `normalizeKeyboardLayoutOverrides(raw)` | Drops legacy **physical-key → `{ output }`** JSON; keeps only **output → string** maps. |
| `getRemappedCharacter({ language, key, shiftKey, capsLock, keyboardLayoutOverrides? })` | Returns the character to insert, or `null` if the key is not a single character or has no mapping. |

### Internal (not exported; used to build layouts and remaps)

| Function | Summary |
| -------- | ------- |
| `key(output, typedWith, shiftOutput?)` | Builds one `KeyboardKey` (base output, physical `typedWith`, optional `shiftOutput`). |
| `shouldUseShiftedCharacter(shiftKey, capsLock)` | Returns whether the shift layer is active (`shiftKey !== capsLock`). |
| `buildRemapTable(layout)` | Flattens layout rows into a map from `typedWith.toLowerCase()` to `{ output, shiftOutput }`, with `shiftOutput` defaulting to `output.toUpperCase()` when omitted. |

---

## Test table (selected)

| Purpose | Notes |
| ------- | ----- |
| Layout shape and default per-language behavior | Row structure, `j`→`й` (ru), `[`→`ü` (de), `;`→`ñ` (es), `[`→`é` (fr), etc. |
| `getRemappedCharacter` | Non-character keys, unmapped keys, shift/caps for Latin, case-insensitive physical lookup; Spanish and French code-based keys where needed. |
| Output→typedWith overrides | Use **swaps** (e.g. `й`/`к`) so two letters do not share one physical key; remap and shift-uppercase behavior. |
| Unknown output keys in override map | Ignored. |
| `getDuplicatePhysicalKeyError` | Detects two different letters sharing one `typedWith`. |
| `diffKeyboardLayoutAgainstLanguageDefaults` | Emits only differing **output → typedWith** pairs. |
| `normalizeKeyboardLayoutOverrides` | Legacy object values dropped; string maps kept. |

---

## Coverage note

**UI integration:** `src/test/integration/language-keyboard.test.tsx` checks overridden physical-key labels and the customize dialog.

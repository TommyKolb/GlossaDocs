# User Story 3 Spec: Integrated Russian On-Screen Keyboard

## Header
- **Story**: As a multilingual writer, I want an integrated on-screen keyboard for a non-Latin alphabet so that I can type special characters directly inside the editor.
- **V1 product focus**: Russian Cyrillic using a **Latin-key phonetic mapping** (type Latin letters; get Cyrillic output). The same UI component also shows **English** and **German** Latin layouts when those document languages are selected.
- **Status**: **Core behavior implemented** in the editor (panel, per-language layouts, physical-key remapping when the keyboard is enabled, visibility toggle + persistence). **Not implemented**: long-press variant picker; dedicated layout IDs (e.g. `ru-phonetic-v1`) separate from the `Language` enum.
- **Depends on**:
  - [`docs/architecture/backend-architecture.md`](../architecture/backend-architecture.md)
  - [`user-story-1-basic-editor-spec.md`](user-story-1-basic-editor-spec.md) (document save path and dual guest/auth persistence)
- **Single-backend assumption**: Same app and backend as Story 1; no separate keyboard service.

## Goal
Ship an in-editor on-screen keyboard that inserts text at the caret, aligns with the document’s selected language, and keeps keyboard visibility in user settings. Russian is the primary non-Latin target; German/English layouts support the same component for Latin scripts.

## Current code baseline
- **Layouts and remapping**: `src/app/utils/keyboardLayouts.ts` — per-`Language` row definitions, `getKeyboardLayout`, `getRemappedCharacter` for physical keys when the keyboard feature is on.
- **Panel UI**: `src/app/components/LanguageKeyboard.tsx` — toggle, rows of keys with primary output + “type with” hint, space bar.
- **Editor wiring**: `src/app/components/Editor.tsx` — `insertTextAtCursor` (uses `document.execCommand('insertText', …)` when available), `LanguageKeyboard` in a side column, `handleKeyDown` remapping when `isKeyboardVisible`, global **Ctrl/Cmd+D** to toggle visibility (see `src/app/utils/keyboardShortcuts.ts`).
- **Settings**: `keyboardVisible` (boolean) via `src/app/data/settings-repository.ts` — **authenticated**: `GET/PUT /settings`; **guest**: `localStorage` key `glossadocs_guest_settings`.
- **Backend**: `keyboardVisible` and `lastUsedLocale` on `PUT /settings` (`backend/src/modules/input-preferences/settings-routes.ts`).

## Architecture (Story 3)

```mermaid
flowchart LR
  user[Writer] --> fe[ReactEditor]
  fe --> kbd[LanguageKeyboard]
  kbd --> ins[insertTextAtCursor]
  ins --> ce[contentEditable]
  fe -->|"Remap when visible"| ins
  fe -->|"Save document"| api[FastifyAPI]
  fe -->|"keyboardVisible"| api
  api --> pg[(PostgreSQL)]
```

### Information flow
1. User opens the editor; settings load and restore **`keyboardVisible`** (default **true** in defaults).
2. With the keyboard **visible**, typing Latin keys while the editor is focused applies **`getRemappedCharacter`** for the active document language (Russian → Cyrillic mapping).
3. Clicking on-screen keys calls **`onInsertCharacter`** → same insertion path as typed text.
4. **Ctrl/Cmd+D** toggles visibility and persists **`keyboardVisible`** through the settings repository (API or guest storage).
5. Document content persists through Story 1 (**autosave** / manual save), unchanged by this story except for inserted characters.

## Functional requirements

### Implemented
- On-screen keyboard panel beside the editor (responsive grid); **shown by default** when settings say visible.
- **Toggle** via button and **Ctrl/Cmd+D**; state persisted in **`keyboardVisible`**.
- **Russian** layout: phonetic Cyrillic mapping (keys show Cyrillic output + Latin “type with” label).
- **English / German** layouts: Latin characters (German includes umlauts / ß) for completeness when those languages are selected.
- Click inserts at the caret; selection is replaced by insertion consistent with `insertText` / fallback range logic.
- Physical-key remapping runs only when the on-screen keyboard is **visible** (see `Editor.tsx` guard).

### Not implemented (this spec vs code)
- **Long-press** for alternate characters / variant picker.
- **Layout registry** keyed by arbitrary layout IDs (`ru-phonetic-v1`); layouts are selected by **`Language`** in `keyboardLayouts.ts` only.
- **Dedicated automated tests** for mapping tables and keyboard UI (listed below as follow-up).

### Undo / redo
- No custom undo stack; behavior follows the browser’s native undo for `contentEditable` / `insertText` (may vary by browser).

## Shared backend contract
Relies on Story 1 for documents. User settings:

- `GET /settings` — returns `lastUsedLocale`, `keyboardVisible`.
- `PUT /settings` — partial update with at least one of those fields.

Guest mode uses the same shape in local storage via `settings-repository.ts`.

## Data model
- **Settings** (per user, backend): `keyboard_visible` equivalent exposed as **`keyboardVisible`** in JSON (camelCase in API). No document columns added for this story.

## UI / behavior contract
- Keyboard is **in-page** next to the editor (not a separate OS window).
- Insertion goes through **`insertTextAtCursor`** so toolbar formatting context applies where the browser allows.
- Russian V1 is **phonetic** (Latin key → Cyrillic character), not a full system IME.

## Extensibility (current vs future)
- **Today**: Add or adjust rows in `LANGUAGE_KEYBOARD_LAYOUTS` and remap tables in `keyboardLayouts.ts`.
- **Future**: Extract a layout registry (id → key map), decouple “document language” from “active keyboard layout”, and add long-press variants without bloating `LanguageKeyboard.tsx`.

## Acceptance criteria (mapped to implementation)

| Criterion | Status |
|-----------|--------|
| Russian phonetic on-screen keys insert Cyrillic at the caret | **Yes** (`LanguageKeyboard` + `RUSSIAN_LAYOUT`) |
| Toggle visibility; preference survives reload | **Yes** (`keyboardVisible` in settings repository) |
| Shift / CapsLock affects **physical** remapping via `getRemappedCharacter` | **Yes** |
| Long-press variants | **No** |
| Save/reopen retains characters (backend or guest) | **Yes** (Story 1 persistence) |
| English/German panels | **Yes** (same component, different rows) |

## Risks and mitigations
- **Insertion divergence**: Mitigated by routing panel and remap through **`insertTextAtCursor`**.
- **IME vs remap**: Remap is skipped during composition (`!event.nativeEvent.isComposing` in `Editor.tsx`) to avoid fighting system input methods.
- **Discoverability of Ctrl/Cmd+D**: Button labels and helper text in `LanguageKeyboard.tsx` document the shortcut.

## Test plan
- **Recommended additions**: unit tests for `getRemappedCharacter` and layout tables; component tests for toggle + insert.
- **Existing related coverage**: backend `backend/test/settings-routes.test.ts`; frontend auth and document repository tests elsewhere under `src/test/`.

import { isLanguage, type Language } from './languages';

export interface KeyboardKey {
  output: string;
  typedWith: string;
  shiftOutput?: string;
}

export type KeyboardLayout = readonly (readonly KeyboardKey[])[];

/**
 * Per-language overrides: **alphabet letter (output)** → **physical key label** (`typedWith`).
 * On-screen letters stay as in the built-in layout; only which key you type with changes.
 * Shift + key uses the same mapping; the shifted character is always `output.toUpperCase()` (existing remap rules).
 */
export type KeyboardLayoutOverrides = Partial<Record<Language, Record<string, string>>>;

interface KeyRemap {
  output: string;
  shiftOutput?: string;
}

function key(output: string, typedWith: string, shiftOutput?: string): KeyboardKey {
  return { output, typedWith, shiftOutput };
}

const ENGLISH_LAYOUT: KeyboardLayout = [
  [key('q', 'q'), key('w', 'w'), key('e', 'e'), key('r', 'r'), key('t', 't'), key('y', 'y'), key('u', 'u'), key('i', 'i'), key('o', 'o'), key('p', 'p')],
  [key('a', 'a'), key('s', 's'), key('d', 'd'), key('f', 'f'), key('g', 'g'), key('h', 'h'), key('j', 'j'), key('k', 'k'), key('l', 'l')],
  [key('z', 'z'), key('x', 'x'), key('c', 'c'), key('v', 'v'), key('b', 'b'), key('n', 'n'), key('m', 'm')],
];

const GERMAN_LAYOUT: KeyboardLayout = [
  [key('q', 'q'), key('w', 'w'), key('e', 'e'), key('r', 'r'), key('t', 't'), key('z', 'z'), key('u', 'u'), key('i', 'i'), key('o', 'o'), key('p', 'p'), key('ü', '[')],
  [key('a', 'a'), key('s', 's'), key('d', 'd'), key('f', 'f'), key('g', 'g'), key('h', 'h'), key('j', 'j'), key('k', 'k'), key('l', 'l'), key('ö', ';'), key('ä', '\'')],
  [key('y', 'y'), key('x', 'x'), key('c', 'c'), key('v', 'v'), key('b', 'b'), key('n', 'n'), key('m', 'm'), key('ß', '-')],
];

const RUSSIAN_LAYOUT: KeyboardLayout = [
  [key('й', 'j'), key('ц', 'c'), key('у', 'u'), key('к', 'k'), key('е', 'e'), key('н', 'n'), key('г', 'g'), key('ш', 'w'), key('щ', 'q'), key('з', 'z'), key('х', 'h')],
  [key('ф', 'f'), key('ы', 'y'), key('в', 'v'), key('а', 'a'), key('п', 'p'), key('р', 'r'), key('о', 'o'), key('л', 'l'), key('д', 'd'), key('ж', ';'), key('э', '\'')],
  [key('я', 'x'), key('ч', '4'), key('с', 's'), key('м', 'm'), key('и', 'i'), key('т', 't'), key('ь', 'b'), key('б', ','), key('ю', '.')],
];

const LANGUAGE_KEYBOARD_LAYOUTS: Readonly<Record<Language, KeyboardLayout>> = {
  en: ENGLISH_LAYOUT,
  de: GERMAN_LAYOUT,
  ru: RUSSIAN_LAYOUT,
};

/** Built-in layout for the language (no user overrides). */
export function getDefaultKeyboardLayout(language: Language): KeyboardLayout {
  return LANGUAGE_KEYBOARD_LAYOUTS[language];
}

/**
 * Apply **output → typedWith** overrides: each built-in letter keeps its display `output`;
 * only `typedWith` changes. Unknown output keys in the override map are ignored.
 */
export function applyOutputToTypedWithOverrides(
  layout: KeyboardLayout,
  overrides: Record<string, string>
): KeyboardLayout {
  return layout.map((row) =>
    row.map((layoutKey) => {
      const typedWith = overrides[layoutKey.output];
      if (typedWith === undefined) {
        return layoutKey;
      }
      const next: KeyboardKey = { ...layoutKey, typedWith };
      delete next.shiftOutput;
      return next;
    })
  ) as KeyboardLayout;
}

export function getKeyboardLayout(language: Language, overrides?: KeyboardLayoutOverrides): KeyboardLayout {
  const base = LANGUAGE_KEYBOARD_LAYOUTS[language];
  const langOverrides = overrides?.[language];
  if (!langOverrides || Object.keys(langOverrides).length === 0) {
    return base;
  }
  return applyOutputToTypedWithOverrides(base, langOverrides);
}

/**
 * Returns **output → typedWith** entries that differ from the built-in layout (for persistence).
 */
export function diffKeyboardLayoutAgainstLanguageDefaults(
  language: Language,
  effective: KeyboardLayout
): Record<string, string> {
  const defFlat = getDefaultKeyboardLayout(language).flat();
  const effFlat = effective.flat();
  const out: Record<string, string> = {};

  for (let i = 0; i < defFlat.length; i++) {
    const def = defFlat[i];
    const eff = effFlat[i];
    if (!def || !eff || def.output !== eff.output) {
      continue;
    }
    if (eff.typedWith !== def.typedWith) {
      out[def.output] = eff.typedWith;
    }
  }

  return out;
}

/**
 * Strips legacy persisted shape (`physicalKey → { output, shiftOutput? }`) and keeps only
 * **output → typedWith** string maps so older guest/API data does not break parsing.
 */
/** If two different letters use the same physical key, returns an error message; otherwise null. */
export function getDuplicatePhysicalKeyError(layout: KeyboardLayout): string | null {
  const map = new Map<string, string>();
  for (const k of layout.flat()) {
    const t = k.typedWith.toLowerCase();
    const prev = map.get(t);
    if (prev !== undefined && prev !== k.output) {
      return `The same physical key cannot type two different letters (“${prev}” and “${k.output}”).`;
    }
    map.set(t, k.output);
  }
  return null;
}

export function normalizeKeyboardLayoutOverrides(raw: unknown): KeyboardLayoutOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const result: KeyboardLayoutOverrides = {};

  for (const [lang, inner] of Object.entries(raw as Record<string, unknown>)) {
    if (!isLanguage(lang)) {
      continue;
    }
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
      continue;
    }

    const per: Record<string, string> = {};
    for (const [key, value] of Object.entries(inner as Record<string, unknown>)) {
      if (typeof value === 'string' && value.length > 0) {
        per[key] = value;
      }
    }

    if (Object.keys(per).length > 0) {
      result[lang] = per;
    }
  }

  return result;
}

function shouldUseShiftedCharacter(shiftKey: boolean, capsLock: boolean): boolean {
  return shiftKey !== capsLock;
}

function buildRemapTable(layout: KeyboardLayout): Readonly<Record<string, KeyRemap>> {
  return layout.reduce<Record<string, KeyRemap>>((acc, row) => {
    row.forEach((layoutKey) => {
      acc[layoutKey.typedWith.toLowerCase()] = {
        output: layoutKey.output,
        shiftOutput: layoutKey.shiftOutput ?? layoutKey.output.toUpperCase(),
      };
    });
    return acc;
  }, {});
}

interface RemapArgs {
  language: Language;
  key: string;
  shiftKey: boolean;
  capsLock: boolean;
  keyboardLayoutOverrides?: KeyboardLayoutOverrides;
}

export function getRemappedCharacter({
  language,
  key,
  shiftKey,
  capsLock,
  keyboardLayoutOverrides
}: RemapArgs): string | null {
  if (key.length !== 1) {
    return null;
  }

  const layout = getKeyboardLayout(language, keyboardLayoutOverrides);
  const table = buildRemapTable(layout);
  const remap = table[key.toLowerCase()];
  if (!remap) {
    return null;
  }

  return shouldUseShiftedCharacter(shiftKey, capsLock)
    ? remap.shiftOutput ?? remap.output
    : remap.output;
}

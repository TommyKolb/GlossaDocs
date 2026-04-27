import { isLanguage, isChineseLanguage, type Language } from './languages';

export interface KeyboardKey {
  output: string;
  typedWith: string;
  shiftOutput?: string;
}

export type KeyboardLayout = readonly (readonly KeyboardKey[])[];
export type KeyboardLayoutLanguage = Exclude<Language, 'zh-Hans' | 'zh-Hant'>;

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

/** Spanish Latin letters on US-style key positions (ñ, ü, accents, ¿¡). */
const SPANISH_LAYOUT: KeyboardLayout = [
  [key('q', 'q'), key('w', 'w'), key('e', 'e'), key('r', 'r'), key('t', 't'), key('y', 'y'), key('u', 'u'), key('i', 'i'), key('o', 'o'), key('p', 'p'), key('ü', '[')],
  [key('a', 'a'), key('s', 's'), key('d', 'd'), key('f', 'f'), key('g', 'g'), key('h', 'h'), key('j', 'j'), key('k', 'k'), key('l', 'l'), key('ñ', ';'), key('á', '\'')],
  [key('z', 'z'), key('x', 'x'), key('c', 'c'), key('v', 'v'), key('b', 'b'), key('n', 'n'), key('m', 'm'), key('é', ','), key('í', '.'), key('ó', '-'), key('ú', '='), key('¿', '`'), key('¡', '/')]
];

/** French letters on US QWERTY positions (common accented letters and ç). */
const FRENCH_LAYOUT: KeyboardLayout = [
  [key('q', 'q'), key('w', 'w'), key('e', 'e'), key('r', 'r'), key('t', 't'), key('y', 'y'), key('u', 'u'), key('i', 'i'), key('o', 'o'), key('p', 'p'), key('é', '[')],
  [key('a', 'a'), key('s', 's'), key('d', 'd'), key('f', 'f'), key('g', 'g'), key('h', 'h'), key('j', 'j'), key('k', 'k'), key('l', 'l'), key('è', ';'), key('ç', '\'')],
  [key('z', 'z'), key('x', 'x'), key('c', 'c'), key('v', 'v'), key('b', 'b'), key('n', 'n'), key('m', 'm'), key('ù', ','), key('à', '.'), key('â', '-'), key('ê', '='), key('ô', '`'), key('ï', '/')]
];

/** Italian accented letters on US QWERTY-style positions. */
const ITALIAN_LAYOUT: KeyboardLayout = [
  [key('q', 'q'), key('w', 'w'), key('e', 'e'), key('r', 'r'), key('t', 't'), key('y', 'y'), key('u', 'u'), key('i', 'i'), key('o', 'o'), key('p', 'p'), key('é', '[')],
  [key('a', 'a'), key('s', 's'), key('d', 'd'), key('f', 'f'), key('g', 'g'), key('h', 'h'), key('j', 'j'), key('k', 'k'), key('l', 'l'), key('à', ';'), key('è', '\'')],
  [key('z', 'z'), key('x', 'x'), key('c', 'c'), key('v', 'v'), key('b', 'b'), key('n', 'n'), key('m', 'm'), key('ì', ','), key('ò', '.'), key('ù', '-')]
];

/** Portuguese: ã, õ, ç, and common accents (Brazil/Europe). */
const PORTUGUESE_LAYOUT: KeyboardLayout = [
  [key('q', 'q'), key('w', 'w'), key('e', 'e'), key('r', 'r'), key('t', 't'), key('y', 'y'), key('u', 'u'), key('i', 'i'), key('o', 'o'), key('p', 'p'), key('ú', '[')],
  [key('a', 'a'), key('s', 's'), key('d', 'd'), key('f', 'f'), key('g', 'g'), key('h', 'h'), key('j', 'j'), key('k', 'k'), key('l', 'l'), key('ã', ';'), key('õ', "'")],
  [key('z', 'z'), key('x', 'x'), key('c', 'c'), key('v', 'v'), key('b', 'b'), key('n', 'n'), key('m', 'm'), key('ç', ','), key('á', '.'), key('é', '-'), key('í', '='), key('ó', '`'), key('à', '/'), key('â', '\\')]
];

/** Dutch: mostly Latin; diacritics for loanwords. */
const DUTCH_LAYOUT: KeyboardLayout = [
  [key('q', 'q'), key('w', 'w'), key('e', 'e'), key('r', 'r'), key('t', 't'), key('y', 'y'), key('u', 'u'), key('i', 'i'), key('o', 'o'), key('p', 'p'), key('é', '[')],
  [key('a', 'a'), key('s', 's'), key('d', 'd'), key('f', 'f'), key('g', 'g'), key('h', 'h'), key('j', 'j'), key('k', 'k'), key('l', 'l'), key('ö', ';'), key('ü', "'")],
  [key('z', 'z'), key('x', 'x'), key('c', 'c'), key('v', 'v'), key('b', 'b'), key('n', 'n'), key('m', 'm'), key('ë', ','), key('ï', '.'), key('è', '-')]
];

/** Polish — standard Latin plus national characters. */
const POLISH_LAYOUT: KeyboardLayout = [
  [key('q', 'q'), key('w', 'w'), key('e', 'e'), key('r', 'r'), key('t', 't'), key('y', 'y'), key('u', 'u'), key('i', 'i'), key('o', 'o'), key('p', 'p'), key('ó', '[')],
  [key('a', 'a'), key('s', 's'), key('d', 'd'), key('f', 'f'), key('g', 'g'), key('h', 'h'), key('j', 'j'), key('k', 'k'), key('l', 'l'), key('ł', ';'), key('ą', "'")],
  [key('z', 'z'), key('x', 'x'), key('c', 'c'), key('v', 'v'), key('b', 'b'), key('n', 'n'), key('m', 'm'), key('ę', ','), key('ć', '.'), key('ń', '-'), key('ś', '='), key('ż', '`'), key('ź', '/')]
];

/** Ukrainian — same QWERTY row layout as the Russian on-screen map; distinct letters (і ї є ґ) where needed. */
const UKRAINIAN_LAYOUT: KeyboardLayout = [
  [key('й', 'j'), key('ц', 'c'), key('у', 'u'), key('к', 'k'), key('е', 'e'), key('н', 'n'), key('г', 'g'), key('ш', 'w'), key('щ', 'q'), key('з', 'z'), key('х', 'h'), key('ї', '['), key('ґ', ']')],
  [key('ф', 'f'), key('і', 'y'), key('в', 'v'), key('а', 'a'), key('п', 'p'), key('р', 'r'), key('о', 'o'), key('л', 'l'), key('д', 'd'), key('ж', ';'), key('є', "'")],
  [key('я', 'x'), key('ч', '4'), key('с', 's'), key('м', 'm'), key('и', 'i'), key('т', 't'), key('ь', 'b'), key('б', ','), key('ю', '.')]
];

/** Indonesian — standard Latin (A–Z); same on-screen map as English. */
const INDONESIAN_LAYOUT: KeyboardLayout = ENGLISH_LAYOUT;

/** Swahili — standard Latin; same on-screen map as English. */
const SWAHILI_LAYOUT: KeyboardLayout = ENGLISH_LAYOUT;

/** Tagalog / Filipino — Latin plus ñ (enye). */
const TAGALOG_LAYOUT: KeyboardLayout = [
  [key('q', 'q'), key('w', 'w'), key('e', 'e'), key('r', 'r'), key('t', 't'), key('y', 'y'), key('u', 'u'), key('i', 'i'), key('o', 'o'), key('p', 'p')],
  [key('a', 'a'), key('s', 's'), key('d', 'd'), key('f', 'f'), key('g', 'g'), key('h', 'h'), key('j', 'j'), key('k', 'k'), key('l', 'l'), key('ñ', ';')],
  [key('z', 'z'), key('x', 'x'), key('c', 'c'), key('v', 'v'), key('b', 'b'), key('n', 'n'), key('m', 'm')]
];

const LANGUAGE_KEYBOARD_LAYOUTS: Readonly<Record<KeyboardLayoutLanguage, KeyboardLayout>> = {
  en: ENGLISH_LAYOUT,
  de: GERMAN_LAYOUT,
  ru: RUSSIAN_LAYOUT,
  es: SPANISH_LAYOUT,
  fr: FRENCH_LAYOUT,
  it: ITALIAN_LAYOUT,
  pt: PORTUGUESE_LAYOUT,
  nl: DUTCH_LAYOUT,
  pl: POLISH_LAYOUT,
  uk: UKRAINIAN_LAYOUT,
  id: INDONESIAN_LAYOUT,
  sw: SWAHILI_LAYOUT,
  tl: TAGALOG_LAYOUT
};

export function isKeyboardLayoutLanguage(language: Language): language is KeyboardLayoutLanguage {
  return !isChineseLanguage(language);
}

/** Built-in layout for the language (no user overrides). */
export function getDefaultKeyboardLayout(language: KeyboardLayoutLanguage): KeyboardLayout {
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
  if (!isKeyboardLayoutLanguage(language)) {
    return [];
  }
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
  language: KeyboardLayoutLanguage,
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

/** One physical key label. Extra characters are dropped when pasting. */
export function normalizeSinglePhysicalKey(value: string): string {
  if (value.length <= 1) {
    return value;
  }
  return value.slice(0, 1);
}

export type PhysicalKeyRow = { output: string; typedWith: string };

/** Output letters that share the same physical key (case-insensitive) with another letter. */
export function getOutputsWithDuplicatePhysicalKeys(rows: PhysicalKeyRow[]): Set<string> {
  const byTyped = new Map<string, string[]>();
  for (const r of rows) {
    const k = r.typedWith.toLowerCase();
    const list = byTyped.get(k) ?? [];
    list.push(r.output);
    byTyped.set(k, list);
  }
  const dups = new Set<string>();
  for (const [, outputs] of byTyped) {
    if (outputs.length > 1) {
      outputs.forEach((o) => dups.add(o));
    }
  }
  return dups;
}

/**
 * Strips legacy object-shaped values; keeps only **output → typedWith** string maps per language.
 */
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
  code?: string;
  shiftKey: boolean;
  capsLock: boolean;
  keyboardLayoutOverrides?: KeyboardLayoutOverrides;
}

const CODE_TO_PHYSICAL_KEY: Readonly<Record<string, string>> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/"
};

function codeToPhysicalKey(code?: string): string | null {
  if (!code) {
    return null;
  }
  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3).toLowerCase();
  }
  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5);
  }
  return CODE_TO_PHYSICAL_KEY[code] ?? null;
}

export function getRemappedCharacter({
  language,
  key,
  code,
  shiftKey,
  capsLock,
  keyboardLayoutOverrides
}: RemapArgs): string | null {
  if (key.length !== 1 && !codeToPhysicalKey(code)) {
    return null;
  }

  const layout = getKeyboardLayout(language, keyboardLayoutOverrides);
  const table = buildRemapTable(layout);
  const keyCandidate = key.length === 1 ? key.toLowerCase() : null;
  const codeCandidate = codeToPhysicalKey(code)?.toLowerCase() ?? null;
  const remap = (keyCandidate ? table[keyCandidate] : undefined) ?? (codeCandidate ? table[codeCandidate] : undefined);
  if (!remap) {
    return null;
  }

  return shouldUseShiftedCharacter(shiftKey, capsLock)
    ? remap.shiftOutput ?? remap.output
    : remap.output;
}

import { Language } from './languages';

export interface KeyboardKey {
  output: string;
  typedWith: string;
  shiftOutput?: string;
}

export type KeyboardLayout = readonly (readonly KeyboardKey[])[];

/** Per physical key (`typedWith`, case-insensitive): override output and optional shift layer. */
export type KeyboardKeyOverride = {
  output: string;
  shiftOutput?: string;
};

/**
 * User overrides per language. Inner keys are physical keys (matched case-insensitively to `typedWith`).
 * Keys that do not exist on the built-in layout for that language are ignored when merging.
 */
export type KeyboardLayoutOverrides = Partial<Record<Language, Record<string, KeyboardKeyOverride>>>;

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
 * Apply per-key overrides immutably. Override map keys are normalized to lowercase for lookup.
 * Override entries for keys not present in `layout` have no effect.
 */
export function mergeKeyboardLayoutWithOverrides(
  layout: KeyboardLayout,
  overrides: Record<string, KeyboardKeyOverride>
): KeyboardLayout {
  const normalized = new Map(
    Object.entries(overrides).map(([k, v]) => [k.toLowerCase(), v] as const)
  );

  return layout.map((row) =>
    row.map((layoutKey) => {
      const o = normalized.get(layoutKey.typedWith.toLowerCase());
      if (!o) {
        return layoutKey;
      }
      const next: KeyboardKey = { ...layoutKey, output: o.output };
      if (o.shiftOutput !== undefined) {
        next.shiftOutput = o.shiftOutput;
      } else {
        delete next.shiftOutput;
      }
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
  return mergeKeyboardLayoutWithOverrides(base, langOverrides);
}

/**
 * Returns per-key overrides for one language: only keys that differ from {@link getDefaultKeyboardLayout}.
 */
export function diffKeyboardLayoutAgainstLanguageDefaults(
  language: Language,
  effective: KeyboardLayout
): Record<string, KeyboardKeyOverride> {
  const defaults = getDefaultKeyboardLayout(language);
  const defFlat = defaults.flat();
  const effFlat = effective.flat();
  const out: Record<string, KeyboardKeyOverride> = {};

  for (const k of effFlat) {
    const def = defFlat.find((d) => d.typedWith.toLowerCase() === k.typedWith.toLowerCase());
    if (!def) {
      continue;
    }
    const defaultShift = def.shiftOutput ?? def.output.toUpperCase();
    const effectiveShift = k.shiftOutput ?? k.output.toUpperCase();
    if (k.output === def.output && effectiveShift === defaultShift) {
      continue;
    }
    const entry: KeyboardKeyOverride = { output: k.output };
    if (effectiveShift !== k.output.toUpperCase()) {
      entry.shiftOutput = effectiveShift;
    }
    out[k.typedWith.toLowerCase()] = entry;
  }

  return out;
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
  /** When set, merges these per-language overrides with built-in layouts before resolving the key. */
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

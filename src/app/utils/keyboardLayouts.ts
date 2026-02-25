import { Language } from './languages';

export interface KeyboardKey {
  output: string;
  typedWith: string;
  shiftOutput?: string;
}

export type KeyboardLayout = readonly (readonly KeyboardKey[])[];

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

export function getKeyboardLayout(language: Language): KeyboardLayout {
  return LANGUAGE_KEYBOARD_LAYOUTS[language];
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

const LANGUAGE_KEY_REMAP_TABLES: Readonly<Record<Language, Readonly<Record<string, KeyRemap>>>> = {
  en: buildRemapTable(ENGLISH_LAYOUT),
  de: buildRemapTable(GERMAN_LAYOUT),
  ru: buildRemapTable(RUSSIAN_LAYOUT),
};

interface RemapArgs {
  language: Language;
  key: string;
  shiftKey: boolean;
  capsLock: boolean;
}

export function getRemappedCharacter({ language, key, shiftKey, capsLock }: RemapArgs): string | null {
  if (key.length !== 1) {
    return null;
  }

  const remap = LANGUAGE_KEY_REMAP_TABLES[language][key.toLowerCase()];
  if (!remap) {
    return null;
  }

  return shouldUseShiftedCharacter(shiftKey, capsLock)
    ? remap.shiftOutput ?? remap.output
    : remap.output;
}

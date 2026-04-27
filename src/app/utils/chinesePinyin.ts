import type { ChineseLanguage } from './languages';
import { CHINESE_PINYIN_DICTIONARY, type ChineseDictionaryEntry } from '../data/chinese-pinyin-dictionary.generated';

export type ChineseScript = 'simplified' | 'traditional';

export interface ChineseCandidate {
  text: string;
  pinyin: string;
  gloss: string;
}

export interface ChineseCandidateLookupArgs {
  pinyin: string;
  script: ChineseScript;
  limit?: number;
}

export type ChinesePinyinKeyAction =
  | { type: 'append'; value: string }
  | { type: 'delete' }
  | { type: 'clear' }
  | { type: 'commit'; candidate: ChineseCandidate }
  | { type: 'none' };

export interface ChinesePinyinKeyActionArgs {
  key: string;
  buffer: string;
  candidates: readonly ChineseCandidate[];
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  captureTextInput?: boolean;
}

const DEFAULT_LIMIT = 8;

const TONE_MARKS: Readonly<Record<string, string>> = {
  ā: 'a',
  á: 'a',
  ǎ: 'a',
  à: 'a',
  ē: 'e',
  é: 'e',
  ě: 'e',
  è: 'e',
  ī: 'i',
  í: 'i',
  ǐ: 'i',
  ì: 'i',
  ō: 'o',
  ó: 'o',
  ǒ: 'o',
  ò: 'o',
  ū: 'u',
  ú: 'u',
  ǔ: 'u',
  ù: 'u',
  ǖ: 'u',
  ǘ: 'u',
  ǚ: 'u',
  ǜ: 'u',
  ü: 'u'
};

const PINYIN_KEYS_BY_FIRST_LETTER = Object.keys(CHINESE_PINYIN_DICTIONARY)
  .sort((a, b) => a.length - b.length || a.localeCompare(b))
  .reduce<Record<string, string[]>>((groups, key) => {
    const firstLetter = key[0];
    if (!firstLetter) {
      return groups;
    }
    (groups[firstLetter] ??= []).push(key);
    return groups;
  }, {});

export function chineseLanguageToScript(language: ChineseLanguage): ChineseScript {
  return language === 'zh-Hans' ? 'simplified' : 'traditional';
}

export function normalizePinyin(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, (mark) => TONE_MARKS[mark] ?? mark)
    .replace(/[1-5]/g, '')
    .replace(/[^a-z]/g, '');
}

function toCandidate(entry: ChineseDictionaryEntry, pinyin: string, script: ChineseScript): ChineseCandidate {
  return {
    text: script === 'simplified' ? entry.s : entry.t,
    pinyin,
    gloss: entry.g
  };
}

function getPrefixCandidates(normalized: string, script: ChineseScript, remaining: number): ChineseCandidate[] {
  const matches: ChineseCandidate[] = [];
  const keys = PINYIN_KEYS_BY_FIRST_LETTER[normalized[0]] ?? [];

  for (const key of keys) {
    if (key === normalized || !key.startsWith(normalized)) {
      continue;
    }

    for (const entry of CHINESE_PINYIN_DICTIONARY[key] ?? []) {
      matches.push(toCandidate(entry, key, script));
      if (matches.length >= remaining) {
        return matches;
      }
    }
  }

  return matches;
}

export function getChineseCandidates({
  pinyin,
  script,
  limit = DEFAULT_LIMIT
}: ChineseCandidateLookupArgs): ChineseCandidate[] {
  const normalized = normalizePinyin(pinyin);
  if (!normalized) {
    return [];
  }

  const exact = CHINESE_PINYIN_DICTIONARY[normalized] ?? [];
  const prefixMatches = exact.length >= limit
    ? []
    : getPrefixCandidates(normalized, script, limit - exact.length);

  const seen = new Set<string>();
  return [
    ...exact.map((entry) => toCandidate(entry, normalized, script)),
    ...prefixMatches
  ]
    .filter((candidate) => {
      const key = `${candidate.text}:${candidate.pinyin}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function resolveChinesePinyinKeyAction({
  key,
  buffer,
  candidates,
  ctrlKey = false,
  metaKey = false,
  altKey = false,
  isComposing = false,
  captureTextInput = false
}: ChinesePinyinKeyActionArgs): ChinesePinyinKeyAction {
  if (ctrlKey || metaKey || altKey || isComposing) {
    return { type: 'none' };
  }

  if (captureTextInput && /^[a-zA-Z]$/.test(key)) {
    return { type: 'append', value: normalizePinyin(key) };
  }

  if (captureTextInput && key === 'Backspace' && buffer) {
    return { type: 'delete' };
  }

  if (key === 'Escape' && buffer) {
    return { type: 'clear' };
  }

  const firstCandidate = candidates[0];
  if ((key === 'Enter' || key === ' ') && firstCandidate) {
    return { type: 'commit', candidate: firstCandidate };
  }

  if (/^[1-9]$/.test(key)) {
    const candidate = candidates[Number(key) - 1];
    if (candidate) {
      return { type: 'commit', candidate };
    }
  }

  return { type: 'none' };
}

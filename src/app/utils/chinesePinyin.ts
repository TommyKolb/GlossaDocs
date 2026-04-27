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

const PINYIN_KEYS = Object.keys(CHINESE_PINYIN_DICTIONARY);

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
    : PINYIN_KEYS
        .filter((key) => key !== normalized && key.startsWith(normalized))
        .sort((a, b) => a.length - b.length || a.localeCompare(b))
        .flatMap((key) => (CHINESE_PINYIN_DICTIONARY[key] ?? []).map((entry) => toCandidate(entry, key, script)));

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

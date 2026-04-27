import type { ChineseLanguage } from './languages';

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

const SIMPLIFIED_CANDIDATES: readonly ChineseCandidate[] = [
  { pinyin: 'nihao', text: '你好', gloss: 'hello' },
  { pinyin: 'xiexie', text: '谢谢', gloss: 'thank you' },
  { pinyin: 'zaijian', text: '再见', gloss: 'goodbye' },
  { pinyin: 'qing', text: '请', gloss: 'please' },
  { pinyin: 'wen', text: '问', gloss: 'ask' },
  { pinyin: 'ma', text: '吗', gloss: 'question particle' },
  { pinyin: 'wo', text: '我', gloss: 'I; me' },
  { pinyin: 'ni', text: '你', gloss: 'you' },
  { pinyin: 'ta', text: '他', gloss: 'he; him' },
  { pinyin: 'ta', text: '她', gloss: 'she; her' },
  { pinyin: 'shi', text: '是', gloss: 'to be' },
  { pinyin: 'de', text: '的', gloss: 'possessive particle' },
  { pinyin: 'bu', text: '不', gloss: 'not' },
  { pinyin: 'zai', text: '在', gloss: 'at; in' },
  { pinyin: 'you', text: '有', gloss: 'to have' },
  { pinyin: 'mei', text: '没', gloss: 'not have; did not' },
  { pinyin: 'hao', text: '好', gloss: 'good' },
  { pinyin: 'ren', text: '人', gloss: 'person' },
  { pinyin: 'ai', text: '爱', gloss: 'love' },
  { pinyin: 'yao', text: '要', gloss: 'want; need' },
  { pinyin: 'zhongguo', text: '中国', gloss: 'China' },
  { pinyin: 'zhongwen', text: '中文', gloss: 'Chinese language' },
  { pinyin: 'hanyu', text: '汉语', gloss: 'Mandarin; Chinese language' },
  { pinyin: 'putonghua', text: '普通话', gloss: 'Mandarin Chinese' },
  { pinyin: 'laoshi', text: '老师', gloss: 'teacher' },
  { pinyin: 'xuesheng', text: '学生', gloss: 'student' },
  { pinyin: 'pengyou', text: '朋友', gloss: 'friend' },
  { pinyin: 'jintian', text: '今天', gloss: 'today' },
  { pinyin: 'mingtian', text: '明天', gloss: 'tomorrow' },
  { pinyin: 'shenme', text: '什么', gloss: 'what' }
];

const TRADITIONAL_CANDIDATES: readonly ChineseCandidate[] = [
  { pinyin: 'nihao', text: '你好', gloss: 'hello' },
  { pinyin: 'xiexie', text: '謝謝', gloss: 'thank you' },
  { pinyin: 'zaijian', text: '再見', gloss: 'goodbye' },
  { pinyin: 'qing', text: '請', gloss: 'please' },
  { pinyin: 'wen', text: '問', gloss: 'ask' },
  { pinyin: 'ma', text: '嗎', gloss: 'question particle' },
  { pinyin: 'wo', text: '我', gloss: 'I; me' },
  { pinyin: 'ni', text: '你', gloss: 'you' },
  { pinyin: 'ta', text: '他', gloss: 'he; him' },
  { pinyin: 'ta', text: '她', gloss: 'she; her' },
  { pinyin: 'shi', text: '是', gloss: 'to be' },
  { pinyin: 'de', text: '的', gloss: 'possessive particle' },
  { pinyin: 'bu', text: '不', gloss: 'not' },
  { pinyin: 'zai', text: '在', gloss: 'at; in' },
  { pinyin: 'you', text: '有', gloss: 'to have' },
  { pinyin: 'mei', text: '沒', gloss: 'not have; did not' },
  { pinyin: 'hao', text: '好', gloss: 'good' },
  { pinyin: 'ren', text: '人', gloss: 'person' },
  { pinyin: 'ai', text: '愛', gloss: 'love' },
  { pinyin: 'yao', text: '要', gloss: 'want; need' },
  { pinyin: 'zhongguo', text: '中國', gloss: 'China' },
  { pinyin: 'zhongwen', text: '中文', gloss: 'Chinese language' },
  { pinyin: 'hanyu', text: '漢語', gloss: 'Mandarin; Chinese language' },
  { pinyin: 'putonghua', text: '普通話', gloss: 'Mandarin Chinese' },
  { pinyin: 'laoshi', text: '老師', gloss: 'teacher' },
  { pinyin: 'xuesheng', text: '學生', gloss: 'student' },
  { pinyin: 'pengyou', text: '朋友', gloss: 'friend' },
  { pinyin: 'jintian', text: '今天', gloss: 'today' },
  { pinyin: 'mingtian', text: '明天', gloss: 'tomorrow' },
  { pinyin: 'shenme', text: '什麼', gloss: 'what' }
];

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

export function getChineseCandidates({
  pinyin,
  script,
  limit = DEFAULT_LIMIT
}: ChineseCandidateLookupArgs): ChineseCandidate[] {
  const normalized = normalizePinyin(pinyin);
  if (!normalized) {
    return [];
  }

  const candidates = script === 'simplified' ? SIMPLIFIED_CANDIDATES : TRADITIONAL_CANDIDATES;
  return candidates
    .filter((candidate) => candidate.pinyin === normalized || candidate.pinyin.startsWith(normalized))
    .sort((a, b) => {
      if (a.pinyin === normalized && b.pinyin !== normalized) return -1;
      if (a.pinyin !== normalized && b.pinyin === normalized) return 1;
      return a.pinyin.length - b.pinyin.length || a.text.localeCompare(b.text);
    })
    .slice(0, limit);
}

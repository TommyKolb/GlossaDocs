/**
 * Generates a compact pinyin candidate dictionary from CC-CEDICT.
 *
 * Source: CC-CEDICT, https://cc-cedict.org/
 * License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
 * Download page: https://cc-cedict.org/editor/editor.php?handler=Download
 *
 * The generated file is intentionally capped per normalized pinyin key so the
 * frontend bundle gets broad learner coverage without trying to ship a full IME.
 */
import { gunzipSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SOURCE_URL = "https://cc-cedict.org/editor/editor_export_cedict.php?c=gz";
const OUTPUT_PATH = path.join(root, "src", "app", "data", "chinese-pinyin-dictionary.generated.ts");
const MAX_CANDIDATES_PER_PINYIN = 12;
const MAX_PINYIN_KEYS = 7000;

const BOOSTS = new Map(
  [
    ["你好", 1200],
    ["谢谢", 1200],
    ["謝謝", 1200],
    ["再见", 1100],
    ["再見", 1100],
    ["请", 1000],
    ["請", 1000],
    ["我", 1000],
    ["你", 1000],
    ["他", 900],
    ["她", 900],
    ["是", 900],
    ["的", 900],
    ["不", 900],
    ["在", 900],
    ["有", 900],
    ["中国", 850],
    ["中國", 850],
    ["中文", 850],
    ["汉语", 850],
    ["漢語", 850],
    ["普通话", 800],
    ["普通話", 800],
    ["老师", 750],
    ["老師", 750],
    ["学生", 750],
    ["學生", 750],
    ["朋友", 700],
    ["今天", 700],
    ["明天", 700],
    ["什么", 700],
    ["什麼", 700],
    ["学校", 650],
    ["學校", 650],
    ["医院", 650],
    ["醫院", 650],
    ["电脑", 650],
    ["電腦", 650],
    ["飞机", 650],
    ["飛機", 650],
    ["火车", 650],
    ["火車", 650],
    ["图书馆", 650],
    ["圖書館", 650],
    ["天气", 650],
    ["天氣", 650]
  ].map(([text, score]) => [text, Number(score)])
);

function normalizePinyin(value) {
  return value
    .toLowerCase()
    .replace(/u:/g, "u")
    .replace(/ü/g, "u")
    .replace(/[1-5]/g, "")
    .replace(/[^a-z]/g, "");
}

function cleanGloss(definitions) {
  const first = definitions
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .find((part) => !part.startsWith("variant of ") && !part.startsWith("CL:"));
  return (first ?? definitions.split("/").find(Boolean) ?? "").replace(/\s+/g, " ").slice(0, 96);
}

function scriptScore(entry) {
  const textScore = Math.max(0, 80 - entry.s.length * 8);
  const hasAscii = /[A-Za-z]/.test(entry.s) || /[A-Za-z]/.test(entry.t) ? -200 : 0;
  const properNounPenalty =
    /\bsurname\b|\bvariant\b|\bold variant\b|\bJapanese\b|\bcountry\b|\bprovince\b|\bcity\b|\bcounty\b|\b(name)\b/i.test(entry.g)
      ? -160
      : 0;
  const uppercaseGlossPenalty = /^[A-Z]/.test(entry.g) ? -60 : 0;
  const boost = Math.max(BOOSTS.get(entry.s) ?? 0, BOOSTS.get(entry.t) ?? 0);
  return boost + textScore + hasAscii + properNounPenalty + uppercaseGlossPenalty;
}

function parseCedict(text) {
  const byPinyin = new Map();
  const linePattern = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/;

  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(linePattern);
    if (!match) {
      continue;
    }

    const [, traditional, simplified, pinyinRaw, definitions] = match;
    const pinyin = normalizePinyin(pinyinRaw);
    if (!pinyin || pinyin.length > 24 || simplified.length > 8 || traditional.length > 8) {
      continue;
    }

    const entry = {
      s: simplified,
      t: traditional,
      g: cleanGloss(definitions)
    };
    if (!entry.g) {
      continue;
    }

    const list = byPinyin.get(pinyin) ?? [];
    const duplicate = list.some((existing) => existing.s === entry.s && existing.t === entry.t);
    if (!duplicate) {
      list.push(entry);
      byPinyin.set(pinyin, list);
    }
  }

  return byPinyin;
}

/** Matches runtime prefix lookup in `chinesePinyin.ts` (length, then locale). */
function buildFirstLetterIndex(keys) {
  const sorted = [...keys].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const groups = {};
  for (const key of sorted) {
    const first = key[0];
    if (!first) {
      continue;
    }
    if (!groups[first]) {
      groups[first] = [];
    }
    groups[first].push(key);
  }
  return groups;
}

function buildOutput(byPinyin) {
  const sortedKeys = [...byPinyin.keys()]
    .sort((a, b) => {
      const maxA = Math.max(...byPinyin.get(a).map(scriptScore));
      const maxB = Math.max(...byPinyin.get(b).map(scriptScore));
      return maxB - maxA || a.length - b.length || a.localeCompare(b);
    })
    .slice(0, MAX_PINYIN_KEYS)
    .sort();

  const recordEntries = sortedKeys.map((pinyin) => {
    const candidates = byPinyin
      .get(pinyin)
      .sort((a, b) => scriptScore(b) - scriptScore(a) || a.s.length - b.s.length || a.s.localeCompare(b.s))
      .slice(0, MAX_CANDIDATES_PER_PINYIN);
    return [pinyin, candidates];
  });

  const keysByFirstLetter = buildFirstLetterIndex(sortedKeys);
  const generatedAt = new Date().toISOString().slice(0, 10);
  return `/* eslint-disable */\n` +
    `/**\n` +
    ` * Generated by scripts/generate-chinese-pinyin-dictionary.mjs on ${generatedAt}.\n` +
    ` * Source: CC-CEDICT (https://cc-cedict.org/), licensed CC BY-SA 4.0.\n` +
    ` * This is a compact candidate dictionary for learner-oriented pinyin input, not a full IME.\n` +
    ` */\n` +
    `export interface ChineseDictionaryEntry {\n` +
    `  /** Simplified form. */\n` +
    `  s: string;\n` +
    `  /** Traditional form. */\n` +
    `  t: string;\n` +
    `  /** Short English gloss from CC-CEDICT. */\n` +
    `  g: string;\n` +
    `}\n\n` +
    `export const CHINESE_PINYIN_DICTIONARY: Readonly<Record<string, readonly ChineseDictionaryEntry[]>> = ${JSON.stringify(Object.fromEntries(recordEntries), null, 2)} as const;\n\n` +
    `/** Precomputed for prefix lookup; keep in sync with the dictionary keys above. */\n` +
    `export const CHINESE_PINYIN_KEYS_BY_FIRST_LETTER: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(keysByFirstLetter, null, 2)} as const;\n`;
}

async function main() {
  console.log(`Downloading CC-CEDICT from ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to download CC-CEDICT: ${response.status} ${response.statusText}`);
  }

  const compressed = Buffer.from(await response.arrayBuffer());
  const text = gunzipSync(compressed).toString("utf8");
  const byPinyin = parseCedict(text);
  await writeFile(OUTPUT_PATH, buildOutput(byPinyin), "utf8");
  console.log(`Generated ${OUTPUT_PATH} with ${Math.min(byPinyin.size, MAX_PINYIN_KEYS)} pinyin keys`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { describe, expect, it } from "vitest";

import {
  chineseLanguageToScript,
  getChineseCandidates,
  normalizePinyin
} from "@/app/utils/chinesePinyin";

describe("Chinese pinyin candidates", () => {
  it("normalizes spaces, tone marks, and tone numbers", () => {
    expect(normalizePinyin("nǐ hǎo")).toBe("nihao");
    expect(normalizePinyin("xie4 xie5")).toBe("xiexie");
  });

  it("returns Simplified candidates for common learner pinyin", () => {
    const candidates = getChineseCandidates({ pinyin: "nihao", script: "simplified" });
    expect(candidates[0]?.text).toBe("你好");
  });

  it("returns Traditional candidates where the script differs", () => {
    const candidates = getChineseCandidates({ pinyin: "xiexie", script: "traditional" });
    expect(candidates[0]?.text).toBe("謝謝");
  });

  it("maps Chinese document language variants to candidate scripts", () => {
    expect(chineseLanguageToScript("zh-Hans")).toBe("simplified");
    expect(chineseLanguageToScript("zh-Hant")).toBe("traditional");
  });
});

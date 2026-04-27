import { describe, expect, it } from "vitest";

import {
  chineseLanguageToScript,
  getChineseCandidates,
  normalizePinyin,
  resolveChinesePinyinKeyAction
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

  it("uses the generated CC-CEDICT dictionary beyond the original starter list", () => {
    const candidates = getChineseCandidates({ pinyin: "tushuguan", script: "simplified" });
    expect(candidates.some((candidate) => candidate.text === "图书馆")).toBe(true);
  });

  it("returns prefix matches when the pinyin buffer is incomplete", () => {
    const candidates = getChineseCandidates({ pinyin: "zhongw", script: "traditional" });
    expect(candidates.some((candidate) => candidate.text === "中文")).toBe(true);
  });

  it("returns no candidates for empty or whitespace pinyin", () => {
    expect(getChineseCandidates({ pinyin: "", script: "simplified" })).toEqual([]);
    expect(getChineseCandidates({ pinyin: "   ", script: "traditional" })).toEqual([]);
  });

  it("honors candidate limits for exact and prefix matches", () => {
    expect(getChineseCandidates({ pinyin: "nihao", script: "simplified", limit: 1 })).toHaveLength(1);
    expect(getChineseCandidates({ pinyin: "zhongw", script: "simplified", limit: 2 }).length).toBeLessThanOrEqual(2);
  });

  it("maps Chinese document language variants to candidate scripts", () => {
    expect(chineseLanguageToScript("zh-Hans")).toBe("simplified");
    expect(chineseLanguageToScript("zh-Hant")).toBe("traditional");
  });

  it("resolves shared pinyin key actions", () => {
    const candidates = [
      { pinyin: "nihao", text: "你好", gloss: "hello" },
      { pinyin: "ni", text: "你", gloss: "you" }
    ];

    expect(resolveChinesePinyinKeyAction({
      key: "n",
      buffer: "",
      candidates,
      captureTextInput: true
    })).toEqual({ type: "append", value: "n" });
    expect(resolveChinesePinyinKeyAction({ key: "Backspace", buffer: "ni", candidates, captureTextInput: true }))
      .toEqual({ type: "delete" });
    expect(resolveChinesePinyinKeyAction({ key: "Escape", buffer: "ni", candidates }))
      .toEqual({ type: "clear" });
    expect(resolveChinesePinyinKeyAction({ key: "2", buffer: "ni", candidates }))
      .toEqual({ type: "commit", candidate: candidates[1] });
    expect(resolveChinesePinyinKeyAction({ key: "n", buffer: "", candidates, isComposing: true }))
      .toEqual({ type: "none" });
  });
});

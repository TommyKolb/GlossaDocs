import { describe, expect, it } from "vitest";

import { languageToLocale, localeToLanguage } from "@/app/data/settings-repository";

describe("settings language locale mapping", () => {
  it("maps Chinese script language variants to regional locale defaults", () => {
    expect(languageToLocale("zh-Hans")).toBe("zh-CN");
    expect(languageToLocale("zh-Hant")).toBe("zh-TW");
  });

  it("maps Chinese locales back to the matching document language variant", () => {
    expect(localeToLanguage("zh-CN")).toBe("zh-Hans");
    expect(localeToLanguage("zh-SG")).toBe("zh-Hans");
    expect(localeToLanguage("zh-TW")).toBe("zh-Hant");
    expect(localeToLanguage("zh-HK")).toBe("zh-Hant");
  });

  it("maps Arabic to ar-SA and regional ar-* locales back to ar", () => {
    expect(languageToLocale("ar")).toBe("ar-SA");
    expect(localeToLanguage("ar-SA")).toBe("ar");
    expect(localeToLanguage("ar-EG")).toBe("ar");
  });
});

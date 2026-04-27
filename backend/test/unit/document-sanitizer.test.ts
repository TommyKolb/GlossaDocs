import { describe, expect, it } from "vitest";

import {
  sanitizeDocumentContent,
  sanitizeDocumentTitle
} from "../../src/shared/document-sanitizer.js";

describe("sanitizeDocumentTitle", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeDocumentTitle("")).toBe("");
  });

  it("strips all HTML and returns plain text only", () => {
    expect(sanitizeDocumentTitle("Hello")).toBe("Hello");
    expect(sanitizeDocumentTitle("<b>Hello</b>")).toBe("Hello");
    expect(sanitizeDocumentTitle("<p>Para</p>")).toBe("Para");
    expect(sanitizeDocumentTitle("A <span>B</span> C")).toBe("A B C");
  });

  it("removes script tags and their content so no executable code remains", () => {
    const out = sanitizeDocumentTitle("<script>alert(1)</script>Title");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("Title");
  });

  it("removes event handler attributes so title cannot trigger script on render", () => {
    const out = sanitizeDocumentTitle('<img onerror="alert(1)" src="x">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
  });

  it("removes style tags and their content", () => {
    const out = sanitizeDocumentTitle("<style>.x{color:red}</style>Title");
    expect(out).not.toContain("style");
    expect(out).not.toContain("color");
    expect(out).toContain("Title");
  });
});

describe("sanitizeDocumentContent", () => {
  it("preserves safe editor tags and strips nothing from allowed set", () => {
    const safe = "<p>Hello</p><div><strong>bold</strong> <em>italic</em> <u>underline</u></div>";
    expect(sanitizeDocumentContent(safe)).toBe(safe);
  });

  it("preserves legacy font tags from rich-text commands", () => {
    const legacy = '<p><font face="Georgia">Hola</font></p>';
    const out = sanitizeDocumentContent(legacy);
    expect(out).toContain("<font");
    expect(out).toContain('face=');
    expect(out).toContain("Hola");
  });

  it("preserves br and span with style", () => {
    const withBr = "<p>Line one<br>Line two</p>";
    const outBr = sanitizeDocumentContent(withBr);
    expect(outBr).toContain("Line one");
    expect(outBr).toContain("Line two");
    expect(outBr).toMatch(/<br\s*\/?>/);
    const withSpan = '<span style="font-size: 14px">Text</span>';
    const outSpan = sanitizeDocumentContent(withSpan);
    expect(outSpan).toContain("<span");
    expect(outSpan).toContain("style=");
    expect(outSpan).toContain("font-size");
    expect(outSpan).toContain("Text");
    expect(outSpan).toContain("</span>");
  });

  it("preserves img with allowed attributes and strips disallowed", () => {
    const img = '<img src="https://example.com/a.png" alt="An image" width="100" height="50">';
    expect(sanitizeDocumentContent(img)).toContain("src=");
    expect(sanitizeDocumentContent(img)).toContain("alt=");
    expect(sanitizeDocumentContent(img)).not.toContain("onerror");
  });

  it("removes script tags so stored content cannot run script when rendered", () => {
    const malicious = "<p>OK</p><script>document.steal = 1;</script><p>OK</p>";
    const out = sanitizeDocumentContent(malicious);
    expect(out).not.toContain("script");
    expect(out).not.toContain("steal");
    expect(out).toContain("OK");
  });

  it("removes inline event handlers so content cannot trigger script", () => {
    const withHandler = '<p onclick="alert(1)">Click</p>';
    const out = sanitizeDocumentContent(withHandler);
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert");
    expect(out).toContain("Click");
  });

  it("removes javascript: URLs from links and img src so no script execution via URL", () => {
    const jsLink = '<a href="javascript:alert(1)">Link</a>';
    const out = sanitizeDocumentContent(jsLink);
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("alert");
    const jsImg = '<img src="javascript:alert(1)">';
    const outImg = sanitizeDocumentContent(jsImg);
    expect(outImg).not.toContain("javascript:");
  });

  it("removes iframe and object so no embedded content can run", () => {
    const iframe = '<iframe src="https://evil.com"></iframe><p>Text</p>';
    const out = sanitizeDocumentContent(iframe);
    expect(out).not.toContain("iframe");
    expect(out).not.toContain("evil");
    expect(out).toContain("Text");
  });

  it("removes style tags so injected CSS cannot run (e.g. expression or behavior)", () => {
    const withStyle = "<style>body { background: url('javascript:alert(1)'); }</style><p>X</p>";
    const out = sanitizeDocumentContent(withStyle);
    expect(out).not.toContain("style");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("X");
  });

  it("allows data URLs for img src when used for inline images", () => {
    const dataImg = '<img src="data:image/png;base64,iVBORw0KGgo=" alt="x">';
    const out = sanitizeDocumentContent(dataImg);
    expect(out).toContain("data:");
    expect(out).toContain("src=");
  });
});

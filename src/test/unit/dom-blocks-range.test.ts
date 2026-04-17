import { afterEach, describe, expect, it } from "vitest";

import { findBlockElementsIntersectingRange } from "@/app/utils/dom";

describe("findBlockElementsIntersectingRange", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("returns the block containing the caret for a collapsed range", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<div>line one</div><div>line two</div>";
    document.body.appendChild(editor);

    const firstLine = editor.querySelector("div") as HTMLElement;
    const text = firstLine.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 3);
    range.collapse(true);

    const blocks = findBlockElementsIntersectingRange(range, editor);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBe(firstLine);
  });

  it("returns every sibling block intersecting a multi-line selection", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<div>line one</div><div>line two</div><div>line three</div>";
    document.body.appendChild(editor);

    const lines = editor.querySelectorAll("div");
    const first = lines[0];
    const last = lines[2];
    const startText = first.firstChild as Text;
    const endText = last.firstChild as Text;

    const range = document.createRange();
    range.setStart(startText, 0);
    range.setEnd(endText, endText.length);

    const blocks = findBlockElementsIntersectingRange(range, editor);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toBe(first);
    expect(blocks[1]).toBe(lines[1]);
    expect(blocks[2]).toBe(last);
  });

  it("prefers nested block elements over an outer wrapper when both intersect", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<div><p>only</p></div>";
    document.body.appendChild(editor);

    const outer = editor.firstElementChild as HTMLElement;
    const inner = outer.querySelector("p") as HTMLElement;
    const text = inner.firstChild as Text;

    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, text.length);

    const blocks = findBlockElementsIntersectingRange(range, editor);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBe(inner);
  });
});

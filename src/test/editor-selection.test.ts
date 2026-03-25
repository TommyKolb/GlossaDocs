import { afterEach, describe, expect, it } from "vitest";

import { ensureSelectionInEditor } from "@/app/utils/editor-selection";

describe("ensureSelectionInEditor", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("creates a collapsed range at the end when there is no selection range", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<p>hello</p>";
    document.body.appendChild(editor);

    window.getSelection()?.removeAllRanges();

    const selection = ensureSelectionInEditor(editor);
    expect(selection).not.toBeNull();
    expect(selection!.rangeCount).toBe(1);
    const range = selection!.getRangeAt(0);
    expect(range.collapsed).toBe(true);
    expect(editor.contains(range.startContainer)).toBe(true);
  });

  it("replaces a selection that lies outside the editor with a caret at the end", () => {
    const editor = document.createElement("div");
    editor.textContent = "editor";
    const outside = document.createElement("span");
    outside.textContent = "outside";
    document.body.appendChild(editor);
    document.body.appendChild(outside);

    const range = document.createRange();
    range.selectNodeContents(outside);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const selection = ensureSelectionInEditor(editor);
    expect(selection).not.toBeNull();
    const newRange = selection!.getRangeAt(0);
    expect(editor.contains(newRange.startContainer)).toBe(true);
    expect(editor.contains(newRange.endContainer)).toBe(true);
  });
});

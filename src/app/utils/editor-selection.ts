/**
 * Ensures the window selection is non-empty and contained within `editorElement`,
 * placing the caret at the end of the editor when there is no valid range.
 */
export function ensureSelectionInEditor(editorElement: HTMLElement): Selection | null {
  const selection = window.getSelection();
  if (!selection) {
    return null;
  }

  if (selection.rangeCount === 0) {
    const range = window.document.createRange();
    range.selectNodeContents(editorElement);
    range.collapse(false);
    selection.addRange(range);
    return selection;
  }

  const range = selection.getRangeAt(0);
  const isRangeInsideEditor =
    editorElement.contains(range.startContainer) && editorElement.contains(range.endContainer);

  if (!isRangeInsideEditor) {
    selection.removeAllRanges();
    const fallbackRange = window.document.createRange();
    fallbackRange.selectNodeContents(editorElement);
    fallbackRange.collapse(false);
    selection.addRange(fallbackRange);
  }

  return selection;
}

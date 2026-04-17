/**
 * DOM utility functions for editor operations
 */

import { BLOCK_LEVEL_TAGS } from './constants';

/**
 * Check if an HTML tag is a block-level element
 */
export function isBlockLevelTag(tagName: string): boolean {
  const normalizedTagName = tagName.toLowerCase();
  return BLOCK_LEVEL_TAGS.some((blockTag) => blockTag === normalizedTagName);
}

/**
 * Find the closest block-level element containing a node
 * @param node - Starting node
 * @param containerElement - Stop searching when reaching this element
 * @returns The closest block-level HTMLElement or null
 */
export function findBlockElement(
  node: Node | null,
  containerElement: HTMLElement | null
): HTMLElement | null {
  if (!node || !containerElement) return null;

  let current = node;

  // First, ensure we're working with an element node
  while (current && current.nodeType !== Node.ELEMENT_NODE) {
    current = current.parentNode;
  }

  // Then, find the closest block-level element
  while (current && current !== containerElement) {
    if (current instanceof HTMLElement) {
      const tagName = current.tagName.toLowerCase();
      if (isBlockLevelTag(tagName)) {
        return current;
      }
    }
    current = current.parentNode;
  }

  return null;
}

function listBlockElementsInDocumentOrder(editorRoot: HTMLElement): HTMLElement[] {
  const ordered: HTMLElement[] = [];
  const w = editorRoot.ownerDocument.createTreeWalker(editorRoot, NodeFilter.SHOW_ELEMENT);
  let n: Node | null = w.nextNode();
  while (n) {
    if (n instanceof HTMLElement && isBlockLevelTag(n.tagName)) {
      ordered.push(n);
    }
    n = w.nextNode();
  }
  return ordered;
}

/** Drop block nodes that are ancestors of another block in the same list (keep deepest only). */
function filterToDeepestBlocksOnly(blocks: HTMLElement[]): HTMLElement[] {
  if (blocks.length <= 1) {
    return [...blocks];
  }
  return blocks.filter((el) => !blocks.some((other) => other !== el && el.contains(other)));
}

/**
 * Block-level elements that should receive line spacing for the current selection.
 * For a multi-line selection (Google Docs–style), every intersected paragraph/block gets the new spacing.
 * Uses the deepest intersecting blocks only (skips ancestors when a descendant block also intersects).
 */
export function findBlockElementsIntersectingRange(
  range: Range,
  editorRoot: HTMLElement
): HTMLElement[] {
  if (range.collapsed) {
    const block = findBlockElement(range.startContainer, editorRoot);
    return block ? [block] : [];
  }

  const candidates: HTMLElement[] = [];
  const walker = editorRoot.ownerDocument.createTreeWalker(editorRoot, NodeFilter.SHOW_ELEMENT);

  let node: Node | null = walker.nextNode();
  while (node) {
    if (node instanceof HTMLElement && isBlockLevelTag(node.tagName)) {
      try {
        if (range.intersectsNode(node)) {
          candidates.push(node);
        }
      } catch {
        // intersectsNode can throw for e.g. Document nodes in some environments
      }
    }
    node = walker.nextNode();
  }

  if (candidates.length === 0) {
    const startBlock = findBlockElement(range.startContainer, editorRoot);
    const endBlock = findBlockElement(range.endContainer, editorRoot);
    if (startBlock && endBlock) {
      return startBlock === endBlock ? [startBlock] : collectBlocksBetween(startBlock, endBlock, editorRoot);
    }
    return startBlock ? [startBlock] : [];
  }

  return filterToDeepestBlocksOnly(candidates);
}

/** When intersectsNode yields nothing, apply spacing to blocks from start to end in document order (inclusive). */
function collectBlocksBetween(
  startBlock: HTMLElement,
  endBlock: HTMLElement,
  editorRoot: HTMLElement
): HTMLElement[] {
  const ordered = listBlockElementsInDocumentOrder(editorRoot);

  let iStart = ordered.indexOf(startBlock);
  let iEnd = ordered.indexOf(endBlock);
  if (iStart === -1 || iEnd === -1) {
    return [startBlock, endBlock].filter((b, j, a) => a.indexOf(b) === j);
  }
  if (iStart > iEnd) {
    const t = iStart;
    iStart = iEnd;
    iEnd = t;
  }

  const slice = ordered.slice(iStart, iEnd + 1);
  return filterToDeepestBlocksOnly(slice);
}

/**
 * Get line height from a block element or its computed style
 * @param element - HTMLElement to check
 * @returns Line height value as string
 */
export function getLineHeight(element: HTMLElement): string {
  const inlineStyle = element.style.lineHeight;
  if (inlineStyle) return inlineStyle;

  const computedStyle = window.getComputedStyle(element);
  return computedStyle.lineHeight || '1.15';
}

/**
 * Cycle through image size options
 * @param currentSize - Current size value
 * @param sizes - Array of size options to cycle through
 * @returns Next size in the cycle
 */
export function getNextImageSize(
  currentSize: string,
  sizes: readonly string[]
): string {
  const currentIndex = sizes.indexOf(currentSize);
  
  if (currentIndex === -1 || currentSize === '' || currentSize === sizes[0]) {
    return sizes[1] || sizes[0];
  }
  
  return sizes[(currentIndex + 1) % sizes.length];
}

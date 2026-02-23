/**
 * DOM utility functions for editor operations
 */

import { BLOCK_LEVEL_TAGS } from './constants';

/**
 * Check if an HTML tag is a block-level element
 */
export function isBlockLevelTag(tagName: string): boolean {
  return BLOCK_LEVEL_TAGS.includes(tagName.toLowerCase() as any);
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

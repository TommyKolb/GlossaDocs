/**
 * Tests for issue #20: PDFs save with title
 *
 * Bug: exportAsPdf prepends the document title as an <h1> inside the PDF
 * render container, even though the title is not part of the user's document
 * content. The saved PDF should be an exact copy of the user's document.
 *
 * These tests are intentionally RED until the bug is fixed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the element passed to html2pdf().from() so tests can inspect it.
let capturedFromElement: HTMLElement | null = null;

vi.mock('html2pdf.js/dist/html2pdf.bundle.min.js', () => {
  const mockInstance = {
    from: vi.fn().mockImplementation((el: HTMLElement) => {
      capturedFromElement = el;
      return mockInstance;
    }),
    set: vi.fn().mockReturnThis(),
    save: vi.fn().mockResolvedValue(undefined),
  };
  return { default: vi.fn(() => mockInstance) };
});

// Polyfill URL.createObjectURL for jsdom
Object.defineProperty(globalThis.URL, 'createObjectURL', {
  value: vi.fn(() => 'blob:mock'),
  writable: true,
});
Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
  value: vi.fn(),
  writable: true,
});

// Minimal iframe stub that writes into an in-memory document.
function stubIframe() {
  const iframeDoc = document.implementation.createHTMLDocument('');

  const iframe = document.createElement('div') as unknown as HTMLIFrameElement;
  Object.defineProperty(iframe, 'contentDocument', {
    get: () => iframeDoc,
    configurable: true,
  });
  // No-op style props accessed during export
  (iframe as unknown as HTMLElement).style.cssText = '';

  const origAppend = document.body.appendChild.bind(document.body);
  const origRemove = document.body.removeChild.bind(document.body);

  vi.spyOn(document.body, 'appendChild').mockImplementationOnce((node) => {
    // Intercept iframe append; return the stub but ignore real DOM insertion
    if (node === (iframe as unknown as Node)) return node;
    return origAppend(node);
  });

  vi.spyOn(document.body, 'removeChild').mockImplementationOnce((node) => {
    if (node === (iframe as unknown as Node)) return node;
    return origRemove(node);
  });

  vi.spyOn(document, 'createElement').mockImplementationOnce(() => {
    return iframe as unknown as HTMLElement;
  });

  return iframeDoc;
}

import { exportAsPdf } from '@/app/utils/export';
import type { Document } from '@/app/models/document';

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    title: 'My Greek Notes',
    content: '<p>Καλημέρα κόσμε</p>',
    language: 'el',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('exportAsPdf — issue #20: title must not appear in PDF', () => {
  beforeEach(() => {
    capturedFromElement = null;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('does not include a title element in the PDF render container', async () => {
    stubIframe();
    const doc = makeDoc({ title: 'My Greek Notes' });

    await exportAsPdf(doc);

    expect(capturedFromElement).not.toBeNull();
    const titleEl = capturedFromElement!.querySelector('h1.pdf-title');
    // This should be null — the title must NOT be injected into the PDF.
    expect(titleEl).toBeNull();
  });

  it('does not render the document title text anywhere in the PDF container', async () => {
    stubIframe();
    const doc = makeDoc({ title: 'Secret Title' });

    await exportAsPdf(doc);

    expect(capturedFromElement).not.toBeNull();
    expect(capturedFromElement!.textContent).not.toContain('Secret Title');
  });

  it('includes only the document content in the PDF render container', async () => {
    stubIframe();
    const content = '<p>Hello world</p>';
    const doc = makeDoc({ title: 'Ignored Title', content });

    await exportAsPdf(doc);

    expect(capturedFromElement).not.toBeNull();
    const contentEl = capturedFromElement!.querySelector('.pdf-content');
    expect(contentEl).not.toBeNull();
    expect(contentEl!.innerHTML).toContain('Hello world');
  });

  it('still uses the title as the PDF filename without embedding it in content', async () => {
    stubIframe();
    const doc = makeDoc({ title: 'Greek Essay', content: '<p>body text only</p>' });

    await exportAsPdf(doc);

    // Title must not appear in the rendered PDF content
    expect(capturedFromElement?.textContent ?? '').not.toContain('Greek Essay');
    // But the document body content should still be present
    expect(capturedFromElement?.textContent ?? '').toContain('body text only');
  });
});

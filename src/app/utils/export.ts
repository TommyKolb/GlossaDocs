import { Document as DocxDocument, Paragraph, TextRun, AlignmentType } from 'docx';
import type { Document as AppDocument } from '../models/document';
import { PDF_CONFIG } from './constants';

export type ExportFormat = 'json' | 'txt' | 'docx' | 'pdf';

const DEFAULT_EXPORT_BASENAME = 'Untitled Document';
const MAX_EXPORT_BASENAME_LENGTH = 120;

function sanitizeFilenameBaseName(title: string): string {
  const normalized = title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  if (!normalized) {
    return DEFAULT_EXPORT_BASENAME;
  }
  return normalized.slice(0, MAX_EXPORT_BASENAME_LENGTH);
}

function buildExportFilename(title: string, extension: string): string {
  return `${sanitizeFilenameBaseName(title)}${extension}`;
}

/**
 * Helper function to trigger a file download
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Extracts plain text from HTML content
 */
export function htmlToPlainText(html: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const blockTags = new Set([
    'P',
    'DIV',
    'LI',
    'UL',
    'OL',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'BLOCKQUOTE',
    'PRE'
  ]);

  function nodeToText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as HTMLElement;
    if (element.tagName === 'BR') {
      return '\n';
    }

    let text = '';
    Array.from(element.childNodes).forEach((child) => {
      text += nodeToText(child);
    });

    if (blockTags.has(element.tagName)) {
      return `${text.replace(/\n+$/g, '')}\n`;
    }
    return text;
  }

  let output = '';
  Array.from(tempDiv.childNodes).forEach((node) => {
    output += nodeToText(node);
  });

  return output.replace(/\n{3,}/g, '\n\n').trimEnd();
}

/**
 * Sanitizes HTML for html2canvas/html2pdf compatibility.
 * Removes class names and style declarations that use unsupported color funcs
 * like oklch(...), while preserving semantic formatting tags.
 */
function removeUnsupportedColorDeclarations(cssText: string): string {
  return cssText
    .replace(/(^|;)\s*[^:;]+:\s*[^;]*oklch\([^)]*\)[^;]*\s*(?=;|$)/gi, '')
    .replace(/;;+/g, ';')
    .replace(/^\s*;\s*|\s*;\s*$/g, '')
    .trim();
}

function sanitizeHtmlForPdf(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;

  const elements = container.querySelectorAll<HTMLElement>('*');
  elements.forEach((element) => {
    element.removeAttribute('class');

    const styleAttr = element.getAttribute('style');
    if (!styleAttr) return;

    const sanitizedStyle = removeUnsupportedColorDeclarations(styleAttr);

    if (sanitizedStyle) {
      element.setAttribute('style', sanitizedStyle);
    } else {
      element.removeAttribute('style');
    }
  });

  return container.innerHTML;
}

function stripUnsupportedColorsFromStyleText(cssText: string): string {
  return cssText.replace(/oklch\([^)]*\)/gi, '#111111');
}

function normalizeStyleAttribute(cssText: string): string {
  return cssText
    .replace(/;;+/g, ';')
    .replace(/^\s*;\s*|\s*;\s*$/g, '')
    .trim();
}

/**
 * Builds the DOM subtree passed to html2pdf (isolated iframe document).
 * Exported for unit tests. PDF body is editor content only; the document title is used for the filename, not the PDF.
 */
export function buildPdfRenderContainer(ownerDoc: Document, doc: AppDocument): HTMLElement {
  const renderContainer = ownerDoc.createElement("div");
  renderContainer.className = "pdf-root";
  renderContainer.id = "pdf-export-root";
  const contentElement = ownerDoc.createElement("div");
  contentElement.className = "pdf-content";
  contentElement.innerHTML = sanitizeHtmlForPdf(doc.content || "<div><br></div>");
  renderContainer.appendChild(contentElement);
  return renderContainer;
}

function sanitizeClonedDocumentForPdf(clonedDoc: Document): void {
  // Remove external stylesheets entirely to avoid unsupported CSS functions.
  clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());

  // Sanitize inline <style> tags that may contain oklch().
  clonedDoc.querySelectorAll('style').forEach((styleEl) => {
    const text = styleEl.textContent ?? '';
    styleEl.textContent = stripUnsupportedColorsFromStyleText(text);
  });

  // Sanitize any style attributes in the cloned DOM.
  clonedDoc.querySelectorAll<HTMLElement>('*').forEach((element) => {
    const styleAttr = element.getAttribute('style');
    if (!styleAttr) return;

    const sanitizedStyle = normalizeStyleAttribute(stripUnsupportedColorsFromStyleText(styleAttr));

    if (sanitizedStyle) {
      element.setAttribute('style', sanitizedStyle);
    } else {
      element.removeAttribute('style');
    }
  });
}

interface DocxRunModel {
  text?: string;
  break?: number;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
}

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];

interface DocxParagraphModel {
  alignment: DocxAlignment;
  runs: DocxRunModel[];
}

interface InlineStyleState {
  bold: boolean;
  italics: boolean;
  underline: boolean;
}

function nextInlineStyleState(element: HTMLElement, current: InlineStyleState): InlineStyleState {
  const tagName = element.tagName;
  return {
    bold: current.bold || tagName === 'B' || tagName === 'STRONG',
    italics: current.italics || tagName === 'I' || tagName === 'EM',
    underline: current.underline || tagName === 'U'
  };
}

function runsFromNode(node: Node, style: InlineStyleState): DocxRunModel[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text.length === 0) {
      return [];
    }
    return [
      {
        text,
        bold: style.bold || undefined,
        italics: style.italics || undefined,
        underline: style.underline || undefined
      }
    ];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as HTMLElement;
  if (element.tagName === 'BR') {
    return [
      {
        break: 1,
        bold: style.bold || undefined,
        italics: style.italics || undefined,
        underline: style.underline || undefined
      }
    ];
  }

  const nextStyle = nextInlineStyleState(element, style);
  return Array.from(element.childNodes).flatMap((child) => runsFromNode(child, nextStyle));
}

function defaultInlineStyleState(): InlineStyleState {
  return { bold: false, italics: false, underline: false };
}

function paragraphAlignmentForElement(element: HTMLElement): DocxAlignment {
  const style = window.getComputedStyle(element);
  if (style.textAlign === 'center') {
    return AlignmentType.CENTER;
  }
  if (style.textAlign === 'right') {
    return AlignmentType.RIGHT;
  }
  return AlignmentType.LEFT;
}

/**
 * Converts HTML content to paragraph/run models for docx export.
 * Exported for regression tests.
 */
export function htmlToDocxParagraphModels(html: string): DocxParagraphModel[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const paragraphs: DocxParagraphModel[] = [];

  Array.from(tempDiv.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text.trim().length > 0) {
        paragraphs.push({
          alignment: AlignmentType.LEFT,
          runs: [{ text }]
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const runs = runsFromNode(element, defaultInlineStyleState());
      if (runs.length === 0) {
        return;
      }
      paragraphs.push({
        alignment: paragraphAlignmentForElement(element),
        runs
      });
    }
  });

  if (paragraphs.length === 0) {
    paragraphs.push({
      alignment: AlignmentType.LEFT,
      runs: [{ text: '' }]
    });
  }

  return paragraphs;
}

/**
 * Converts HTML content to structured paragraphs for docx
 */
function htmlToDocxParagraphs(html: string): Paragraph[] {
  return htmlToDocxParagraphModels(html).map((paragraph) => {
    const children = paragraph.runs.map((run) => {
      if (run.break) {
        return new TextRun({
          break: run.break,
          bold: run.bold,
          italics: run.italics,
          underline: run.underline ? {} : undefined
        });
      }
      return new TextRun({
        text: run.text ?? '',
        bold: run.bold,
        italics: run.italics,
        underline: run.underline ? {} : undefined
      });
    });

    return new Paragraph({
      children,
      alignment: paragraph.alignment
    });
  });
}

/**
 * Exports document as plain text (.txt)
 */
export function exportAsText(doc: AppDocument): void {
  const plainText = htmlToPlainText(doc.content);
  const blob = new Blob([plainText], { type: 'text/plain' });
  triggerDownload(blob, buildExportFilename(doc.title, '.txt'));
}

/**
 * Exports document as Word document (.docx)
 */
export async function exportAsDocx(doc: AppDocument): Promise<void> {
  const paragraphs = htmlToDocxParagraphs(doc.content);

  const docxDoc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  // Use the Packer to generate a blob
  const { Packer } = await import('docx');
  const blob = await Packer.toBlob(docxDoc);
  
  triggerDownload(blob, buildExportFilename(doc.title, '.docx'));
}

/**
 * Exports document as PDF (.pdf)
 * Uses html2pdf/html2canvas with an isolated render container
 */
export async function exportAsPdf(doc: AppDocument): Promise<void> {
  // Render inside an isolated iframe so html2canvas does not parse app-wide CSS
  // tokens (like oklch) that it cannot handle.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = '900px';
  iframe.style.height = '1200px';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      throw new Error('Failed to initialize PDF rendering context.');
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #111;
              font-family: Arial, Helvetica, sans-serif;
            }
            .pdf-root {
              width: 794px;
              padding: 28px 32px;
              box-sizing: border-box;
              font-size: 16px;
              line-height: 1.6;
              white-space: pre-wrap;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .pdf-content {
              white-space: pre-wrap;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
          </style>
        </head>
        <body></body>
      </html>
    `);
    iframeDoc.close();

    const renderContainer = buildPdfRenderContainer(iframeDoc, doc);
    iframeDoc.body.appendChild(renderContainer);

    const html2pdfModule = await import('html2pdf.js/dist/html2pdf.bundle.min.js');
    const html2pdf = (html2pdfModule as { default?: any }).default ?? html2pdfModule;
    await new Promise<void>((resolve, reject) => {
      html2pdf()
        .from(renderContainer)
        .set({
          margin: PDF_CONFIG.MARGIN / 4,
          filename: buildExportFilename(doc.title, '.pdf'),
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc: Document) => {
              sanitizeClonedDocumentForPdf(clonedDoc);

              // Re-apply critical container styles in case stylesheet stripping removed them.
              const clonedRoot = clonedDoc.getElementById('pdf-export-root');
              if (clonedRoot) {
                const rootStyle = clonedRoot as HTMLElement;
                rootStyle.style.width = '794px';
                rootStyle.style.padding = '28px 32px';
                rootStyle.style.boxSizing = 'border-box';
                rootStyle.style.fontFamily = 'Arial, Helvetica, sans-serif';
                rootStyle.style.fontSize = '16px';
                rootStyle.style.lineHeight = '1.6';
                rootStyle.style.whiteSpace = 'pre-wrap';
                rootStyle.style.overflowWrap = 'anywhere';
                rootStyle.style.wordBreak = 'break-word';
                rootStyle.style.color = '#111111';
                rootStyle.style.backgroundColor = '#ffffff';
              }
            },
          },
          jsPDF: {
            unit: 'mm',
            format: PDF_CONFIG.FORMAT,
            orientation: PDF_CONFIG.ORIENTATION,
          },
          pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['img'],
          },
        })
        .save()
        .then(() => resolve())
        .catch((error: unknown) => reject(error));
    });
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Exports document as JSON (.glossadoc.json) - original format
 */
export function exportAsJson(doc: AppDocument): void {
  const dataStr = JSON.stringify(doc, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  triggerDownload(dataBlob, buildExportFilename(doc.title, '.glossadoc.json'));
}

/**
 * Main export function that handles all formats
 */
export async function exportDocument(doc: AppDocument, format: ExportFormat): Promise<void> {
  switch (format) {
    case 'txt':
      exportAsText(doc);
      break;
    case 'docx':
      await exportAsDocx(doc);
      break;
    case 'pdf':
      await exportAsPdf(doc);
      break;
    case 'json':
      exportAsJson(doc);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
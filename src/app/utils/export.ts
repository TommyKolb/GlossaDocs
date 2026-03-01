import { Document as DocxDocument, Paragraph, TextRun, AlignmentType } from 'docx';
import { Document } from './db';
import { PDF_CONFIG } from './constants';

export type ExportFormat = 'json' | 'txt' | 'docx' | 'pdf';

/**
 * Helper function to trigger a file download
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Extracts plain text from HTML content
 */
function htmlToPlainText(html: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
}

/**
 * Sanitizes HTML for html2canvas/html2pdf compatibility.
 * Removes class names and style declarations that use unsupported color funcs
 * like oklch(...), while preserving semantic formatting tags.
 */
function sanitizeHtmlForPdf(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;

  const elements = container.querySelectorAll<HTMLElement>('*');
  elements.forEach((element) => {
    element.removeAttribute('class');

    const styleAttr = element.getAttribute('style');
    if (!styleAttr) return;

    const sanitizedStyle = styleAttr
      // Remove individual declarations whose value contains oklch(...)
      .replace(/(^|;)\s*[^:;]+:\s*[^;]*oklch\([^)]*\)[^;]*\s*(?=;|$)/gi, '')
      // Normalize leftover semicolon spacing
      .replace(/;;+/g, ';')
      .replace(/^\s*;\s*|\s*;\s*$/g, '')
      .trim();

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

    const sanitizedStyle = stripUnsupportedColorsFromStyleText(styleAttr)
      .replace(/;;+/g, ';')
      .replace(/^\s*;\s*|\s*;\s*$/g, '')
      .trim();

    if (sanitizedStyle) {
      element.setAttribute('style', sanitizedStyle);
    } else {
      element.removeAttribute('style');
    }
  });
}

/**
 * Converts HTML content to structured paragraphs for docx
 */
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const paragraphs: Paragraph[] = [];
  
  // Process each child element
  tempDiv.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun(text)],
          })
        );
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const text = element.textContent?.trim();
      if (!text) return;

      const textRun = new TextRun({
        text,
        bold: element.querySelector('b, strong') !== null,
        italics: element.querySelector('i, em') !== null,
        underline: element.querySelector('u') ? {} : undefined,
      });

      let alignment = AlignmentType.LEFT;
      const style = window.getComputedStyle(element);
      if (style.textAlign === 'center') alignment = AlignmentType.CENTER;
      else if (style.textAlign === 'right') alignment = AlignmentType.RIGHT;

      paragraphs.push(
        new Paragraph({
          children: [textRun],
          alignment,
        })
      );
    }
  });

  // If no paragraphs were created, add an empty one
  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
  }

  return paragraphs;
}

/**
 * Exports document as plain text (.txt)
 */
export function exportAsText(doc: Document): void {
  const plainText = htmlToPlainText(doc.content);
  const blob = new Blob([plainText], { type: 'text/plain' });
  triggerDownload(blob, `${doc.title}.txt`);
}

/**
 * Exports document as Word document (.docx)
 */
export async function exportAsDocx(doc: Document): Promise<void> {
  const paragraphs = htmlToDocxParagraphs(doc.content);
  
  const docxDoc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: doc.title,
                bold: true,
                size: 32, // 16pt
              }),
            ],
            spacing: {
              after: 400,
            },
          }),
          ...paragraphs,
        ],
      },
    ],
  });

  // Use the Packer to generate a blob
  const { Packer } = await import('docx');
  const blob = await Packer.toBlob(docxDoc);
  
  triggerDownload(blob, `${doc.title}.docx`);
}

/**
 * Exports document as PDF (.pdf)
 * Uses html2pdf/html2canvas with an isolated render container
 */
export async function exportAsPdf(doc: Document): Promise<void> {
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
            .pdf-title {
              margin: 0 0 20px 0;
              font-size: 28px;
              font-weight: 700;
              line-height: 1.2;
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

    const renderContainer = iframeDoc.createElement('div');
    renderContainer.className = 'pdf-root';
    renderContainer.id = 'pdf-export-root';
    const titleElement = iframeDoc.createElement('h1');
    titleElement.className = 'pdf-title';
    titleElement.textContent = doc.title || 'Untitled Document';
    const contentElement = iframeDoc.createElement('div');
    contentElement.className = 'pdf-content';
    contentElement.innerHTML = sanitizeHtmlForPdf(doc.content || '<div><br></div>');

    renderContainer.appendChild(titleElement);
    renderContainer.appendChild(contentElement);
    iframeDoc.body.appendChild(renderContainer);

    const html2pdfModule = await import('html2pdf.js/dist/html2pdf.bundle.min.js');
    const html2pdf = (html2pdfModule as { default?: any }).default ?? html2pdfModule;
    await new Promise<void>((resolve, reject) => {
      html2pdf()
        .from(renderContainer)
        .set({
          margin: PDF_CONFIG.MARGIN / 4,
          filename: `${doc.title || 'Untitled Document'}.pdf`,
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
export function exportAsJson(doc: Document): void {
  const dataStr = JSON.stringify(doc, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  triggerDownload(dataBlob, `${doc.title}.glossadoc.json`);
}

/**
 * Main export function that handles all formats
 */
export async function exportDocument(doc: Document, format: ExportFormat): Promise<void> {
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
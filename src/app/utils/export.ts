import { Document as DocxDocument, Paragraph, TextRun, AlignmentType } from 'docx';
import { jsPDF } from 'jspdf';
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
 * Uses jsPDF to create a simple text-based PDF without HTML rendering
 */
export async function exportAsPdf(doc: Document): Promise<void> {
  const pdf = new jsPDF({
    orientation: PDF_CONFIG.ORIENTATION,
    unit: 'mm',
    format: PDF_CONFIG.FORMAT,
  });

  // Extract plain text from HTML content
  const plainText = htmlToPlainText(doc.content);
  
  // Set up document styling
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - (PDF_CONFIG.MARGIN * 2);
  let currentY = PDF_CONFIG.MARGIN;

  // Add content
  pdf.setFontSize(PDF_CONFIG.FONT_SIZE);
  pdf.setFont('helvetica', 'normal');
  
  // Split text into lines that fit the page width
  const contentLines = pdf.splitTextToSize(plainText, maxWidth);
  
  contentLines.forEach((line: string) => {
    // Check if we need a new page
    if (currentY + PDF_CONFIG.LINE_HEIGHT > pageHeight - PDF_CONFIG.MARGIN) {
      pdf.addPage();
      currentY = PDF_CONFIG.MARGIN;
    }
    
    pdf.text(line, PDF_CONFIG.MARGIN, currentY);
    currentY += PDF_CONFIG.LINE_HEIGHT;
  });

  // Save the PDF
  pdf.save(`${doc.title}.pdf`);
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
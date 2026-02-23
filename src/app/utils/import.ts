// Document import utilities for GlossaDocs
import mammoth from 'mammoth';
import { Document, generateId } from './db';

/**
 * Import a .txt file
 */
async function importTxtFile(file: File): Promise<Document> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        
        // Extract filename without extension as title
        const title = file.name.replace(/\.txt$/i, '');
        
        // Convert plain text to HTML paragraphs
        const paragraphs = text.split('\n').filter(line => line.trim());
        const content = paragraphs.length > 0 
          ? paragraphs.map(p => `<div>${p}</div>`).join('')
          : '<div><br></div>';
        
        const doc: Document = {
          id: generateId(),
          title: title || 'Untitled Document',
          content: content,
          language: 'en', // Default to English
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        resolve(doc);
      } catch (error) {
        reject(new Error('Failed to read text file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Import a .docx file
 */
async function importDocxFile(file: File): Promise<Document> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // Use mammoth to extract HTML from .docx
        const result = await mammoth.convertToHtml({ arrayBuffer });
        let html = result.value;
        
        // Extract filename without extension as title
        const title = file.name.replace(/\.docx$/i, '');
        
        // Clean up the HTML and ensure proper structure
        // Replace <p> tags with <div> for consistency with our editor
        html = html.replace(/<p>/g, '<div>').replace(/<\/p>/g, '</div>');
        
        // If empty, add a default empty div
        if (!html.trim()) {
          html = '<div><br></div>';
        }
        
        const doc: Document = {
          id: generateId(),
          title: title || 'Untitled Document',
          content: html,
          language: 'en', // Default to English
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        resolve(doc);
      } catch (error) {
        reject(new Error('Failed to read DOCX file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Import a document file (.txt or .docx)
 * Creates a new document with the content from the file
 */
export async function importDocumentFile(file: File): Promise<Document> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.txt')) {
    return importTxtFile(file);
  } else if (fileName.endsWith('.docx')) {
    return importDocxFile(file);
  } else {
    throw new Error('Unsupported file format. Please upload a .txt or .docx file.');
  }
}

/**
 * Validate if a file is a supported document format
 */
export function isSupportedDocumentFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith('.txt') || fileName.endsWith('.docx');
}

/**
 * Server-side HTML sanitization for document title and content.
 * Applied on the document write path to prevent stored XSS and dangerous markup.
 */
import sanitizeHtml from "sanitize-html";

/** Strip all HTML from title; return plain text. */
export function sanitizeDocumentTitle(title: string): string {
  return sanitizeHtml(title, { allowedTags: [], allowedAttributes: {} });
}

/** Allowed tags for rich-text document content (editor output). */
const ALLOWED_CONTENT_TAGS = [
  "p",
  "div",
  "br",
  "span",
  "font",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "img"
];

/** Allowed attributes per tag for document content. */
const ALLOWED_CONTENT_ATTRIBUTES: Record<string, string[]> = {
  span: ["style"],
  div: ["style"],
  p: ["style"],
  /** Legacy output from execCommand(fontName) in some browsers; face is the font family. */
  // Do not allow `style` on `font` — it bypassed sanitize-html's usual CSS hardening in url() cases.
  font: ["face", "color"],
  img: ["src", "alt", "width", "height", "style"]
};

/** Sanitize document HTML content; allow only safe tags and attributes. */
export function sanitizeDocumentContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: ALLOWED_CONTENT_TAGS,
    allowedAttributes: ALLOWED_CONTENT_ATTRIBUTES,
    allowedSchemes: ["http", "https", "data"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowedSchemesAppliedToAttributes: ["src"]
  });
}

declare module "sanitize-html" {
  interface Options {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    allowedSchemesByTag?: Record<string, string[]>;
    allowedSchemesAppliedToAttributes?: string[];
  }
  function sanitizeHtml(html: string, options?: Options): string;
  export = sanitizeHtml;
}

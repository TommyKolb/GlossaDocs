/**
 * Shared type definitions for GlossaDocs
 */

export interface FormattingState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  justifyLeft: boolean;
  justifyCenter: boolean;
  justifyRight: boolean;
}

export type FormatCommand = 'bold' | 'italic' | 'underline' | 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'lineHeight';
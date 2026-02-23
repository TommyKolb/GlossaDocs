import { useState, useCallback } from 'react';
import { FormattingState } from '../utils/types';

/**
 * Custom hook to manage text formatting state
 * Tracks bold, italic, and underline states based on current cursor position
 */
export function useFormattingState() {
  const [formattingState, setFormattingState] = useState<FormattingState>({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
  });

  const updateFormattingState = useCallback(() => {
    try {
      const bold = window.document.queryCommandState('bold');
      const italic = window.document.queryCommandState('italic');
      const underline = window.document.queryCommandState('underline');
      const justifyLeft = window.document.queryCommandState('justifyLeft');
      const justifyCenter = window.document.queryCommandState('justifyCenter');
      const justifyRight = window.document.queryCommandState('justifyRight');
      
      setFormattingState({ bold, italic, underline, justifyLeft, justifyCenter, justifyRight });
    } catch (error) {
      // Ignore errors from queryCommandState
      console.warn('Failed to query formatting state:', error);
    }
  }, []);

  return { formattingState, updateFormattingState };
}
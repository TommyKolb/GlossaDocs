import { useEffect, useRef } from 'react';
import { AUTO_SAVE_DELAY_MS } from '../utils/constants';

/**
 * Custom hook to handle auto-saving after a delay
 * 
 * @param hasUnsavedChanges - Whether there are unsaved changes
 * @param onSave - Callback function to execute the save
 */
export function useAutoSave(
  hasUnsavedChanges: boolean,
  onSave: () => void | Promise<void>
) {
  const timerRef = useRef<number | null>(null);
  const saveCallbackRef = useRef(onSave);

  // Keep the callback ref updated without causing effect re-runs
  useEffect(() => {
    saveCallbackRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Set up new timer if there are unsaved changes
    if (hasUnsavedChanges) {
      timerRef.current = window.setTimeout(() => {
        saveCallbackRef.current();
      }, AUTO_SAVE_DELAY_MS);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [hasUnsavedChanges]);
}
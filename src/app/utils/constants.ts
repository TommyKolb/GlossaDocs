/**
 * Application-wide constants for GlossaDocs
 */

// Auto-save configuration
export const AUTO_SAVE_DELAY_MS = 10000; // 10 seconds

// PDF export configuration
export const PDF_CONFIG = {
  MARGIN: 20,
  LINE_HEIGHT: 7,
  FONT_SIZE: 12,
  ORIENTATION: 'portrait' as const,
  FORMAT: 'a4' as const,
};

// Editor configuration
export const EDITOR_CONFIG = {
  DEFAULT_TITLE: 'Untitled Document',
  DEFAULT_LANGUAGE: 'en' as const,
  MIN_HEIGHT: '600px',
  LINE_HEIGHT: '1.8',
  FONT_SIZE: '16px',
};

// Font size options for the editor
export const FONT_SIZE_OPTIONS = [
  { value: '1', label: 'Small' },
  { value: '3', label: 'Normal' },
  { value: '5', label: 'Large' },
  { value: '7', label: 'Huge' },
] as const;

// UI constants
export const UI_CONSTANTS = {
  // Common gradient background used across the app
  GRADIENT_BACKGROUND: 'bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50',
  
  // Image upload constraints
  MAX_IMAGE_SIZE_MB: 5,
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
  
  // Image size cycle options
  IMAGE_SIZES: ['100%', '75%', '50%', '25%'] as const,
  
  // Animation timings
  WELCOME_MESSAGE_INTERVAL_MS: 3000,
} as const;

// Block-level HTML tags for text formatting
export const BLOCK_LEVEL_TAGS = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
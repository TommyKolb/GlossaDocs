import { FormatCommand } from './types';

interface KeyboardShortcutEvent {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export type EditorShortcutAction = FormatCommand | 'save' | 'toggleKeyboard';

const FORMAT_SHORTCUTS: Readonly<Record<string, FormatCommand>> = {
  b: 'bold',
  i: 'italic',
  u: 'underline',
};

function hasPrimaryModifier(event: KeyboardShortcutEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey;
}

export function getEditorShortcutAction(event: KeyboardShortcutEvent): EditorShortcutAction | null {
  if (!hasPrimaryModifier(event)) {
    return null;
  }

  const key = event.key.toLowerCase();
  const code = event.code?.toLowerCase();

  if (key === 's' || code === 'keys') {
    return 'save';
  }

  if (key === 'd' || code === 'keyd') {
    return 'toggleKeyboard';
  }

  if (code === 'keyb') return 'bold';
  if (code === 'keyi') return 'italic';
  if (code === 'keyu') return 'underline';

  return FORMAT_SHORTCUTS[key] ?? null;
}

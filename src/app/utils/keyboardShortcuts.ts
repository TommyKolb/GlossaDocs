import { FormatCommand } from './types';

interface KeyboardShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export type EditorShortcutAction = FormatCommand | 'save';

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

  if (key === 's') {
    return 'save';
  }

  return FORMAT_SHORTCUTS[key] ?? null;
}

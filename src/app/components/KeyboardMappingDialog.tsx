import * as React from 'react';
import { useEffect, useState } from 'react';

import type { Language } from '../utils/languages';
import { getLanguageName } from '../utils/languages';
import {
  diffKeyboardLayoutAgainstLanguageDefaults,
  getDefaultKeyboardLayout,
  getKeyboardLayout,
  type KeyboardKey,
  type KeyboardLayout,
  type KeyboardLayoutOverrides
} from '../utils/keyboardLayouts';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Input } from './ui/input';

interface KeyboardMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  keyboardLayoutOverrides: KeyboardLayoutOverrides;
  onSave: (next: KeyboardLayoutOverrides) => void;
}

type RowState = { typedWith: string; output: string; shift: string };

function flatRowsForLanguage(language: Language, overrides: KeyboardLayoutOverrides): RowState[] {
  const layout = getKeyboardLayout(language, overrides);
  return layout.flat().map((k) => ({
    typedWith: k.typedWith,
    output: k.output,
    shift: k.shiftOutput ?? k.output.toUpperCase()
  }));
}

function buildLayoutFromRows(language: Language, rows: RowState[]) {
  const byKey = new Map(rows.map((r) => [r.typedWith.toLowerCase(), r]));
  return getDefaultKeyboardLayout(language).map((row) =>
    row.map((k) => {
      const r = byKey.get(k.typedWith.toLowerCase());
      if (!r) {
        return k;
      }
      const next: KeyboardKey = { ...k, output: r.output };
      if (r.shift !== r.output.toUpperCase()) {
        next.shiftOutput = r.shift;
      } else {
        delete next.shiftOutput;
      }
      return next;
    })
  ) as KeyboardLayout;
}

export function KeyboardMappingDialog({
  open,
  onOpenChange,
  language,
  keyboardLayoutOverrides,
  onSave
}: KeyboardMappingDialogProps) {
  const [rows, setRows] = useState<RowState[]>(() =>
    flatRowsForLanguage(language, keyboardLayoutOverrides)
  );

  useEffect(() => {
    if (open) {
      setRows(flatRowsForLanguage(language, keyboardLayoutOverrides));
    }
  }, [open, language, keyboardLayoutOverrides]);

  const handleRowChange = (typedWith: string, field: 'output' | 'shift', value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.typedWith === typedWith ? { ...r, [field]: value } : r))
    );
  };

  const handleSave = () => {
    const effective = buildLayoutFromRows(language, rows);
    const langPatch = diffKeyboardLayoutAgainstLanguageDefaults(language, effective);
    const next: KeyboardLayoutOverrides = { ...keyboardLayoutOverrides };
    if (Object.keys(langPatch).length === 0) {
      delete next[language];
    } else {
      next[language] = langPatch;
    }
    onSave(next);
    onOpenChange(false);
  };

  const resetLanguage = () => {
    const next: KeyboardLayoutOverrides = { ...keyboardLayoutOverrides };
    delete next[language];
    onSave(next);
    onOpenChange(false);
  };

  const resetAll = () => {
    onSave({});
    onOpenChange(false);
  };

  const languageName = getLanguageName(language);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Customize keyboard — {languageName}</DialogTitle>
          <DialogDescription>
            Change what appears when you type each physical key (shown as “type with”). Leave shift blank
            behavior uses the uppercase of the output character. Reset restores built-in mappings for this
            app version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 text-xs font-medium text-gray-600 pb-1 border-b">
            <span>Key</span>
            <span>Output</span>
            <span>Shift</span>
          </div>
          {rows.map((row) => (
            <div
              key={`${language}-${row.typedWith}`}
              className="grid grid-cols-[4rem_1fr_1fr] gap-2 items-center"
            >
              <span className="text-sm text-gray-700 font-mono">{row.typedWith}</span>
              <Input
                aria-label={`Output for physical key ${row.typedWith}`}
                value={row.output}
                onChange={(e) => handleRowChange(row.typedWith, 'output', e.target.value)}
                className="h-9 text-sm"
              />
              <Input
                aria-label={`Shift output for physical key ${row.typedWith}`}
                value={row.shift}
                onChange={(e) => handleRowChange(row.typedWith, 'shift', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <div className="flex flex-wrap gap-2 mr-auto">
            <Button type="button" variant="outline" size="sm" onClick={resetLanguage}>
              Reset {languageName}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetAll}>
              Reset all languages
            </Button>
          </div>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save mappings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

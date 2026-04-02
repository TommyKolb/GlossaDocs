import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { Language } from '../utils/languages';
import { getLanguageName } from '../utils/languages';
import {
  diffKeyboardLayoutAgainstLanguageDefaults,
  getDefaultKeyboardLayout,
  getDuplicatePhysicalKeyError,
  getKeyboardLayout,
  getOutputsWithDuplicatePhysicalKeys,
  normalizeSinglePhysicalKey,
  type KeyboardKey,
  type KeyboardLayout,
  type KeyboardLayoutOverrides
} from '../utils/keyboardLayouts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog';
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
import { cn } from './ui/utils';

interface KeyboardMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  keyboardLayoutOverrides: KeyboardLayoutOverrides;
  onSave: (next: KeyboardLayoutOverrides) => void;
}

type RowState = { output: string; typedWith: string };

function rowsForLanguage(language: Language, overrides: KeyboardLayoutOverrides): RowState[] {
  return getKeyboardLayout(language, overrides).flat().map((k) => ({
    output: k.output,
    typedWith: k.typedWith
  }));
}

function buildEffectiveLayoutFromRows(language: Language, rows: RowState[]): KeyboardLayout {
  const byOutput = new Map(rows.map((r) => [r.output, r.typedWith]));
  return getDefaultKeyboardLayout(language).map((row) =>
    row.map((k) => {
      const tw = byOutput.get(k.output);
      if (tw === undefined) {
        return k;
      }
      const next: KeyboardKey = { ...k, typedWith: tw };
      delete next.shiftOutput;
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
  const [rows, setRows] = useState<RowState[]>(() => rowsForLanguage(language, keyboardLayoutOverrides));
  const [confirmReset, setConfirmReset] = useState<'language' | 'all' | null>(null);

  useEffect(() => {
    if (open) {
      setRows(rowsForLanguage(language, keyboardLayoutOverrides));
    }
  }, [open, language, keyboardLayoutOverrides]);

  const duplicateOutputs = useMemo(() => getOutputsWithDuplicatePhysicalKeys(rows), [rows]);
  const emptyOutputs = useMemo(
    () => new Set(rows.filter((row) => row.typedWith.length === 0).map((row) => row.output)),
    [rows]
  );

  const handleTypedWithChange = (output: string, value: string) => {
    const typedWith = normalizeSinglePhysicalKey(value);
    setRows((prev) => prev.map((r) => (r.output === output ? { ...r, typedWith } : r)));
  };

  const handleSave = () => {
    if (emptyOutputs.size > 0) {
      toast.error('Each letter must be assigned to a physical key. Empty mappings are not allowed.');
      return;
    }
    const effective = buildEffectiveLayoutFromRows(language, rows);
    const dup = getDuplicatePhysicalKeyError(effective);
    if (dup) {
      toast.error(dup);
      return;
    }
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

  const applyResetLanguage = () => {
    const next: KeyboardLayoutOverrides = { ...keyboardLayoutOverrides };
    delete next[language];
    onSave(next);
    onOpenChange(false);
    setConfirmReset(null);
  };

  const applyResetAll = () => {
    onSave({});
    onOpenChange(false);
    setConfirmReset(null);
  };

  const languageName = getLanguageName(language);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Customize keyboard — {languageName}</DialogTitle>
            <DialogDescription>
              Each letter stays in the same place on the on-screen keyboard. Enter a single physical key (one
              letter, number, or symbol) per row—pasting multiple characters keeps only the first. Fields
              cannot be empty. Two letters cannot share the same key; conflicting rows are outlined in red.
              Shift + key still uses the uppercase of that letter (for example, Latin “a” → “A”).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-[3rem_1fr] gap-2 text-xs font-medium text-gray-600 pb-1 border-b">
              <span>Letter</span>
              <span>Type with (physical key)</span>
            </div>
            {rows.map((row) => (
              <div
                key={`${language}-${row.output}`}
                className="grid grid-cols-[3rem_1fr] gap-2 items-center"
              >
                <span className="text-sm font-semibold text-gray-900 text-center" aria-hidden>
                  {row.output}
                </span>
                <Input
                  aria-label={`Physical key for letter ${row.output}`}
                  aria-invalid={duplicateOutputs.has(row.output) || emptyOutputs.has(row.output)}
                  value={row.typedWith}
                  maxLength={1}
                  onChange={(e) => handleTypedWithChange(row.output, e.target.value)}
                  className={cn(
                    'h-9 text-sm font-mono',
                    (duplicateOutputs.has(row.output) || emptyOutputs.has(row.output)) &&
                      'border-destructive ring-2 ring-destructive/35 focus-visible:border-destructive focus-visible:ring-destructive/50'
                  )}
                />
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <div className="flex flex-wrap gap-2 mr-auto">
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmReset('language')}>
                Reset {languageName}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmReset('all')}>
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

      <AlertDialog open={confirmReset !== null} onOpenChange={(o) => !o && setConfirmReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmReset === 'all' ? 'Reset all keyboard mappings?' : `Reset ${languageName} keyboard?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmReset === 'all' ? (
                <>
                  This removes your custom physical-key assignments for <strong>every</strong> language. The
                  letters on the on-screen keyboard stay the same; only which keys you type with return to the
                  built-in defaults for this app version. You can customize again at any time.
                </>
              ) : (
                <>
                  This removes your custom physical-key assignments for <strong>{languageName}</strong> only.
                  The letters on the on-screen keyboard stay the same; only which keys you type with return to
                  the built-in defaults for this app version.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReset === 'all') {
                  applyResetAll();
                } else if (confirmReset === 'language') {
                  applyResetLanguage();
                }
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

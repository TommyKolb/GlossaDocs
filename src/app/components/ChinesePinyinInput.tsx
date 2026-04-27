import type { KeyboardEvent } from 'react';

import type { ChineseLanguage } from '../utils/languages';
import { getLanguageName } from '../utils/languages';
import { resolveChinesePinyinKeyAction, type ChineseCandidate } from '../utils/chinesePinyin';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ChinesePinyinInputProps {
  language: ChineseLanguage;
  isVisible: boolean;
  onToggleVisibility: () => void;
  buffer: string;
  candidates: readonly ChineseCandidate[];
  onBufferChange: (next: string) => void;
  onCandidateSelect: (candidate: ChineseCandidate) => void;
  onClearBuffer: () => void;
  className?: string;
}

export function ChinesePinyinInput({
  language,
  isVisible,
  onToggleVisibility,
  buffer,
  candidates,
  onBufferChange,
  onCandidateSelect,
  onClearBuffer,
  className
}: ChinesePinyinInputProps) {
  const languageName = getLanguageName(language);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const action = resolveChinesePinyinKeyAction({
      key: event.key,
      buffer,
      candidates,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      isComposing: event.nativeEvent.isComposing
    });

    if (action.type === 'clear') {
      event.preventDefault();
      onClearBuffer();
    } else if (action.type === 'commit') {
      event.preventDefault();
      onCandidateSelect(action.candidate);
    }
  };

  return (
    <section className={className ?? 'w-full'} aria-label={`${languageName} pinyin input`}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm font-medium text-gray-700">{languageName} starter pinyin input</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleVisibility}
            aria-expanded={isVisible}
            aria-label={`${isVisible ? 'Hide' : 'Show'} pinyin input using Control or Command plus D`}
          >
            {isVisible ? 'Hide input (Ctrl/Cmd+D)' : 'Show input (Ctrl/Cmd+D)'}
          </Button>
        </div>

        <p className="text-xs text-gray-600 mb-3" role="status" aria-live="polite">
          {isVisible
            ? 'This is a starter learner dictionary, not a full Chinese IME. Type supported pinyin, then press Space, Enter, or a number to choose a candidate. Installed Chinese keyboards still work normally.'
            : 'Pinyin input is hidden. Typed keys use normal browser input. Press Control or Command plus D to enable.'}
        </p>

        {isVisible ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor={`${language}-pinyin-buffer`} className="text-xs font-medium text-gray-600">
                Pinyin buffer
              </label>
              <Input
                id={`${language}-pinyin-buffer`}
                value={buffer}
                onChange={(event) => onBufferChange(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Type nihao, xiexie, zhongwen..."
                autoComplete="off"
                spellCheck={false}
                aria-describedby={`${language}-pinyin-help`}
              />
              <p id={`${language}-pinyin-help`} className="text-[11px] text-gray-500">
                Tone marks and numbers are optional. If a word is missing, use your system Chinese keyboard or expand the candidate dictionary.
              </p>
              <p className="text-[11px] text-gray-500">
                Candidate data is derived from CC-CEDICT (CC BY-SA 4.0) and lightly ranked for this app.
              </p>
            </div>

            <div className="space-y-2" role="group" aria-label={`${languageName} candidate choices`}>
              {candidates.length > 0 ? (
                candidates.map((candidate, index) => (
                  <Button
                    key={`${candidate.pinyin}-${candidate.text}`}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onCandidateSelect(candidate)}
                    aria-label={`Choose candidate ${index + 1}: ${candidate.text}`}
                  >
                    <span className="font-mono text-xs text-gray-500">{index + 1}</span>
                    <span className="text-base font-semibold">{candidate.text}</span>
                    <span className="text-xs text-gray-600">{candidate.pinyin}</span>
                    <span className="ml-auto text-xs text-gray-500">{candidate.gloss}</span>
                  </Button>
                ))
              ) : (
                <p className="text-xs text-gray-500">
                  {buffer ? 'No starter-dictionary candidates yet. Try a common learner word like nihao, or use an installed Chinese keyboard.' : 'Start typing pinyin to see starter candidates.'}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

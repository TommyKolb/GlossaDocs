import { Button } from './ui/button';
import { getLanguageName, type Language } from '../utils/languages';
import { getKeyboardLayout } from '../utils/keyboardLayouts';

interface LanguageKeyboardProps {
  language: Language;
  isVisible: boolean;
  onToggleVisibility: () => void;
  onInsertCharacter: (character: string) => void;
}

export function LanguageKeyboard({
  language,
  isVisible,
  onToggleVisibility,
  onInsertCharacter,
}: LanguageKeyboardProps) {
  const layout = getKeyboardLayout(language);
  const languageName = getLanguageName(language);

  return (
    <section
      className="max-w-4xl mx-auto w-full mt-4"
      aria-label={`${languageName} on-screen keyboard`}
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">
            {languageName} keyboard
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleVisibility}
            aria-expanded={isVisible}
            aria-label={`${isVisible ? 'Hide' : 'Show'} on-screen keyboard`}
          >
            {isVisible ? 'Hide keyboard' : 'Show keyboard'}
          </Button>
        </div>

        <p className="text-xs text-gray-600 mb-3" role="status" aria-live="polite">
          {isVisible
            ? 'Keyboard is enabled. Typed keys follow the selected language mapping.'
            : 'Keyboard is disabled. Typed keys use normal typing.'}
        </p>

        {isVisible ? (
          <div className="space-y-2" role="group" aria-label={`${languageName} keyboard keys`}>
            {layout.map((row, rowIndex) => (
              <div key={`${language}-row-${rowIndex}`} className="flex flex-wrap gap-2">
                {row.map((layoutKey) => (
                  <Button
                    key={`${language}-${rowIndex}-${layoutKey.output}-${layoutKey.typedWith}`}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-w-11 h-10 px-2"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onInsertCharacter(layoutKey.output)}
                    aria-label={`Insert ${layoutKey.output} using ${layoutKey.typedWith}`}
                  >
                    <span className="flex flex-col items-center leading-none">
                      <span className="text-sm font-semibold">{layoutKey.output}</span>
                      <span className="text-[10px] text-gray-500">{layoutKey.typedWith}</span>
                    </span>
                  </Button>
                ))}
              </div>
            ))}
            <div className="pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-24"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onInsertCharacter(' ')}
                aria-label="Insert space"
              >
                Space
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

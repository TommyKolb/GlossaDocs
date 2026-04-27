import { LanguageInfo } from '../utils/languages';

interface LanguageBadgeProps {
  language: LanguageInfo;
}

export function LanguageBadge({ language }: LanguageBadgeProps) {
  return (
    <div
      className="w-full min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 bg-white rounded-full shadow-sm border border-gray-200"
      aria-label={language.label}
    >
      <span
        className="tabular-nums min-w-[1.5rem] shrink-0 text-center text-sm sm:text-base font-semibold text-gray-600"
        style={{ lineHeight: 1 }}
        aria-hidden="true"
      >
        {language.listBadge}
      </span>
      <span 
        className="min-w-0 truncate text-xs sm:text-sm font-medium text-gray-700"
        style={{ lineHeight: 1 }}
        title={language.label}
      >
        {language.label}
      </span>
    </div>
  );
}

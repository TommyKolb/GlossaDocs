import * as React from 'react';
import { Languages, ChevronsUpDown } from 'lucide-react';
import { Button } from './ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';
import {
  LANGUAGES,
  isLanguage,
  type Language,
  type LanguagePickerGroup,
  type LanguageInfo
} from '../utils/languages';

const PICKER_GROUP_ORDER: LanguagePickerGroup[] = ['Latin', 'Cyrillic', 'Arabic', 'Chinese'];

function bucketLanguagesByGroup(): Record<LanguagePickerGroup, LanguageInfo[]> {
  const buckets: Record<LanguagePickerGroup, LanguageInfo[]> = {
    Latin: [],
    Cyrillic: [],
    Arabic: [],
    Chinese: []
  };
  for (const lang of LANGUAGES) {
    buckets[lang.pickerGroup].push(lang);
  }
  for (const g of PICKER_GROUP_ORDER) {
    buckets[g].sort((a, b) => a.label.localeCompare(b.label));
  }
  return buckets;
}

interface DocumentLanguagePickerProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  className?: string;
}

export function DocumentLanguagePicker({
  language,
  onLanguageChange,
  className
}: DocumentLanguagePickerProps) {
  const [open, setOpen] = React.useState(false);
  const grouped = React.useMemo(() => bucketLanguagesByGroup(), []);
  const current = LANGUAGES.find((l) => l.value === language);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select document language"
          className={cn(
            'w-[140px] sm:w-[180px] justify-between gap-1 font-normal px-2 sm:px-3',
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
            <Languages className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
            {current ? (
              <>
                <span
                  className="tabular-nums shrink-0 text-[10px] font-semibold text-gray-600"
                  aria-hidden="true"
                >
                  {current.listBadge}
                </span>
                <span className="truncate">{current.label}</span>
              </>
            ) : (
              <span>Language</span>
            )}
          </span>
          <ChevronsUpDown className="ms-1 size-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-1.5rem,22rem)] p-0 sm:w-[22rem]"
        align="start"
        sideOffset={4}
      >
        <Command
          label="Search languages"
          shouldFilter
          className="[&_[cmdk-input-wrapper]]:px-1 [&_[cmdk-input-wrapper]]:py-1"
        >
          <CommandInput placeholder="Search languages…" />
          <CommandList>
            <CommandEmpty>No language found.</CommandEmpty>
            {PICKER_GROUP_ORDER.map((groupName) => {
              const langs = grouped[groupName];
              if (langs.length === 0) {
                return null;
              }
              return (
                <CommandGroup key={groupName} heading={groupName}>
                  {langs.map((lang) => (
                    <CommandItem
                      key={lang.value}
                      value={lang.value}
                      keywords={[
                        lang.label,
                        lang.welcomeLabel,
                        lang.listBadge,
                        lang.value
                      ]}
                      onSelect={(value) => {
                        if (isLanguage(value)) {
                          onLanguageChange(value);
                        }
                        setOpen(false);
                      }}
                    >
                      <span className="flex w-full items-center gap-2">
                        <span
                          className="tabular-nums min-w-[1.5rem] text-center text-[10px] font-semibold text-gray-600"
                          aria-hidden="true"
                        >
                          {lang.listBadge}
                        </span>
                        <span className="flex flex-col gap-0.5 truncate">
                          <span>{lang.label}</span>
                          <span className="truncate text-xs text-muted-foreground font-normal">
                            {lang.welcomeLabel}
                          </span>
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

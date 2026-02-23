import { 
  Bold, 
  Italic, 
  Underline, 
  Save, 
  Download, 
  ArrowLeft,
  Languages,
  Type,
  Circle,
  Check,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  LineChart,
  Image
} from 'lucide-react';
import { Button } from './ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Separator } from './ui/separator';
import { LANGUAGES, type Language } from '../utils/languages';
import { type ExportFormat } from '../utils/export';
import { FONT_SIZE_OPTIONS } from '../utils/constants';
import { type FormattingState } from '../utils/types';

interface EditorToolbarProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onSave: () => void;
  onDownload: (format: ExportFormat) => void;
  onBack: () => void;
  onFormat: (command: string) => void;
  formattingState: FormattingState;
  isSaving: boolean;
  title: string;
  onTitleChange: (title: string) => void;
  hasUnsavedChanges: boolean;
  onInsertImage: () => void;
}

export function EditorToolbar({
  language,
  onLanguageChange,
  onSave,
  onDownload,
  onBack,
  onFormat,
  formattingState,
  isSaving,
  title,
  onTitleChange,
  hasUnsavedChanges,
  onInsertImage,
}: EditorToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      {/* Top bar with back button and document title */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack} 
          className="gap-1 sm:gap-2 flex-shrink-0"
          aria-label="Back to document list"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled Document"
          className="flex-1 text-base sm:text-lg font-semibold bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded min-w-0"
          aria-label="Document title"
        />

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0" title="Unsaved changes" role="status" aria-live="polite">
            <Circle className="size-2 fill-amber-500 text-amber-500" aria-hidden="true" />
            <span className="hidden sm:inline">Unsaved</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0" title="All changes saved" role="status" aria-live="polite">
            <Check className="size-3 text-green-600" aria-hidden="true" />
            <span className="hidden sm:inline text-green-600">Saved</span>
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="gap-1 sm:gap-2"
            aria-label={isSaving ? 'Saving document' : 'Save document'}
          >
            <Save className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1 sm:gap-2"
                aria-label="Download document in various formats"
              >
                <Download className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Download</span>
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuItem onClick={() => onDownload('pdf')}>
                Download as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload('docx')}>
                Download as DOCX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload('txt')}>
                Download as TXT
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Separator />

      {/* Formatting toolbar - scrollable on mobile */}
      <div className="px-3 sm:px-6 py-2 overflow-x-auto">
        <div className="flex items-center gap-2 sm:gap-4 min-w-max">
          {/* Language selector */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Languages className="size-4 text-gray-500" aria-hidden="true" />
            <Select value={language} onValueChange={onLanguageChange as (value: string) => void}>
              <SelectTrigger className="w-[140px] sm:w-[180px]" aria-label="Select document language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-6" aria-hidden="true" />

          {/* Text formatting buttons */}
          <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-label="Text formatting">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFormat('bold')}
              title="Bold (Ctrl+B)"
              className={formattingState.bold ? 'bg-gray-200 hover:bg-gray-300 text-gray-900' : 'text-gray-600'}
              aria-label="Bold"
              aria-pressed={formattingState.bold}
            >
              <Bold className="size-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFormat('italic')}
              title="Italic (Ctrl+I)"
              className={formattingState.italic ? 'bg-gray-200 hover:bg-gray-300 text-gray-900' : 'text-gray-600'}
              aria-label="Italic"
              aria-pressed={formattingState.italic}
            >
              <Italic className="size-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFormat('underline')}
              title="Underline (Ctrl+U)"
              className={formattingState.underline ? 'bg-gray-200 hover:bg-gray-300 text-gray-900' : 'text-gray-600'}
              aria-label="Underline"
              aria-pressed={formattingState.underline}
            >
              <Underline className="size-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" aria-hidden="true" />

          {/* Font size selector */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Type className="size-4 text-gray-500" aria-hidden="true" />
            <Select defaultValue="3" onValueChange={(value) => onFormat(`fontSize:${value}`)}>
              <SelectTrigger className="w-[100px] sm:w-[120px]" aria-label="Select font size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" aria-hidden="true" />

          {/* Text alignment buttons */}
          <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-label="Text alignment">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFormat('justifyLeft')}
              title="Align Left"
              className={formattingState.justifyLeft ? 'bg-gray-200 hover:bg-gray-300 text-gray-900' : 'text-gray-600'}
              aria-label="Align left"
              aria-pressed={formattingState.justifyLeft}
            >
              <AlignLeft className="size-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFormat('justifyCenter')}
              title="Align Center"
              className={formattingState.justifyCenter ? 'bg-gray-200 hover:bg-gray-300 text-gray-900' : 'text-gray-600'}
              aria-label="Align center"
              aria-pressed={formattingState.justifyCenter}
            >
              <AlignCenter className="size-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFormat('justifyRight')}
              title="Align Right"
              className={formattingState.justifyRight ? 'bg-gray-200 hover:bg-gray-300 text-gray-900' : 'text-gray-600'}
              aria-label="Align right"
              aria-pressed={formattingState.justifyRight}
            >
              <AlignRight className="size-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" aria-hidden="true" />

          {/* Line spacing selector */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <LineChart className="size-4 text-gray-500" aria-hidden="true" />
            <Select defaultValue="1.15" onValueChange={(value) => onFormat(`lineHeight:${value}`)}>
              <SelectTrigger className="w-[100px] sm:w-[120px]" aria-label="Select line spacing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.0">Single</SelectItem>
                <SelectItem value="1.15">1.15</SelectItem>
                <SelectItem value="1.5">1.5</SelectItem>
                <SelectItem value="2.0">Double</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" aria-hidden="true" />

          {/* Insert image button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onInsertImage}
              title="Insert Image"
              className="text-gray-600"
              aria-label="Insert image"
            >
              <Image className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
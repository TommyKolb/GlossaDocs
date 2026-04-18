import type { DragEvent, KeyboardEvent, MouseEvent } from 'react';
import { FileText, Trash2, Calendar } from 'lucide-react';
import type { Document } from '../models/document';
import { getLanguageInfo } from '../utils/languages';
import { formatDocumentDate } from '../utils/date';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface DocumentCardProps {
  document: Document;
  onSelect: (id: string) => void;
  onDelete: (id: string, event: MouseEvent) => void;
  onRequestMove: (id: string) => void;
  onDragStartDocument: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onDragDocument: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onDragEndDocument: () => void;
  isDragging?: boolean;
}

export function DocumentCard({
  document,
  onSelect,
  onDelete,
  onRequestMove,
  onDragStartDocument,
  onDragDocument,
  onDragEndDocument,
  isDragging = false
}: DocumentCardProps) {
  const languageInfo = getLanguageInfo(document.language);
  const openDocLabel = `Open document: ${document.title || 'Untitled Document'}. Last modified ${formatDocumentDate(document.updatedAt)}. Language: ${languageInfo?.label || document.language}`;

  function handleCardClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) return;
    onSelect(document.id);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    event.preventDefault();
    onSelect(document.id);
  }

  return (
    <Card
      role="group"
      aria-label={openDocLabel}
      className={`p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-all bg-white/90 backdrop-blur border border-gray-200 hover:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 min-h-[138px] ${
        isDragging ? 'invisible' : ''
      }`}
      draggable
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      onDragStart={(event) => onDragStartDocument(document.id, event)}
      onDrag={(event) => onDragDocument(document.id, event)}
      onDragEnd={onDragEndDocument}
    >
      <div className="h-full flex flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 text-left rounded-md p-1 -m-1">
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="size-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-900 truncate block">
                {document.title || 'Untitled Document'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="size-3.5" aria-hidden="true" />
              <span>{formatDocumentDate(document.updatedAt)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => onDelete(document.id, e)}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 h-7 w-7 p-0"
            aria-label={`Delete document: ${document.title || 'Untitled Document'}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          {languageInfo ? (
            <span
              className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full flex items-center gap-1"
              aria-label={`Document language: ${languageInfo.label}`}
            >
              <span aria-hidden="true">{languageInfo.flag}</span>
              <span>{languageInfo.label}</span>
            </span>
          ) : (
            <span className="text-xs text-gray-500">Language: {document.language}</span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onRequestMove(document.id);
            }}
            aria-label={`Move ${document.title || 'Untitled Document'} to another folder`}
          >
            Move
          </Button>
        </div>
      </div>
    </Card>
  );
}

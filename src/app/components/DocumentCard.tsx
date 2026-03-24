import { FileText, Trash2, Calendar } from 'lucide-react';
import type { Document, Folder } from '../models/document';
import { getLanguageInfo } from '../utils/languages';
import { formatDocumentDate } from '../utils/date';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface DocumentCardProps {
  document: Document;
  folders: Folder[];
  onSelect: (id: string) => void;
  onDelete: (id: string, event: React.MouseEvent) => void;
  onMoveToFolder: (id: string, folderId: string | null) => Promise<void>;
}

export function DocumentCard({ document, folders, onSelect, onDelete, onMoveToFolder }: DocumentCardProps) {
  const languageInfo = getLanguageInfo(document.language);

  return (
    <Card
      className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all bg-white/90 backdrop-blur border border-gray-200 hover:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
      onClick={() => onSelect(document.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(document.id);
        }
      }}
      aria-label={`Open document: ${document.title || 'Untitled Document'}. Last modified ${formatDocumentDate(document.updatedAt)}. Language: ${languageInfo?.label || document.language}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
            <FileText className="size-5 sm:size-6 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
              {document.title || 'Untitled Document'}
            </h3>
            {languageInfo && (
              <span 
                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium bg-blue-100 text-blue-700 rounded-full flex items-center gap-1 sm:gap-1.5"
                aria-label={`Document language: ${languageInfo.label}`}
              >
                <span className="text-sm sm:text-base" aria-hidden="true">{languageInfo.flag}</span>
                <span className="hidden sm:inline">{languageInfo.label}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 ml-0 sm:ml-9">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Calendar className="size-3 sm:size-4" aria-hidden="true" />
              <span>{formatDocumentDate(document.updatedAt)}</span>
            </div>
            <label className="inline-flex items-center gap-2">
              <span className="sr-only">Move document to folder</span>
              <select
                className="text-xs border rounded px-2 py-1 bg-white"
                value={document.folderId ?? ''}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  event.stopPropagation();
                  const value = event.target.value;
                  void onMoveToFolder(document.id, value.length > 0 ? value : null);
                }}
                aria-label={`Move ${document.title || 'Untitled Document'} to folder`}
              >
                <option value="">Root</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => onDelete(document.id, e)}
          className="text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
          aria-label={`Delete document: ${document.title || 'Untitled Document'}`}
        >
          <Trash2 className="size-4 sm:size-5" />
        </Button>
      </div>
    </Card>
  );
}
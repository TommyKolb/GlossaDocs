import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { EditorToolbar } from './EditorToolbar';
import { LanguageKeyboard } from './LanguageKeyboard';
import { 
  Document, 
  getDocument, 
  saveDocument, 
  generateId
} from '../utils/db';
import { exportDocument, type ExportFormat } from '../utils/export';
import { getLanguageName, type Language } from '../utils/languages';
import { EDITOR_CONFIG, UI_CONSTANTS } from '../utils/constants';
import { findBlockElement, getLineHeight, getNextImageSize } from '../utils/dom';
import { getRemappedCharacter } from '../utils/keyboardLayouts';
import { getEditorShortcutAction } from '../utils/keyboardShortcuts';
import { useFormattingState } from '../hooks/useFormattingState';
import { useAutoSave } from '../hooks/useAutoSave';
import { toast } from 'sonner';

interface EditorProps {
  documentId: string | null;
  onBack: () => void;
}

export function Editor({ documentId, onBack }: EditorProps) {
  // State hooks
  const [document, setDocument] = useState<Document | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(true);
  
  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  
  // Custom hooks
  const { formattingState, updateFormattingState } = useFormattingState();
  const activeLanguage = document?.language ?? EDITOR_CONFIG.DEFAULT_LANGUAGE;

  // Callbacks
  const handleSave = useCallback(async () => {
    if (!document || !editorRef.current) return;

    setIsSaving(true);
    const updatedDoc = {
      ...document,
      content: editorRef.current.innerHTML,
      updatedAt: Date.now(),
    };

    try {
      await saveDocument(updatedDoc);
      setDocument(updatedDoc);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Failed to save document');
    } finally {
      setIsSaving(false);
    }
  }, [document]);

  const handleContentChange = useCallback(() => {
    setHasUnsavedChanges(true);
    updateFormattingState();
  }, [updateFormattingState]);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (!document) return;
    setDocument({ ...document, title: newTitle });
    setHasUnsavedChanges(true);
  }, [document]);

  const handleLanguageChange = useCallback((newLanguage: Language) => {
    if (!document) return;
    
    setDocument({ ...document, language: newLanguage });
    setHasUnsavedChanges(true);
    
    // Apply text direction based on language (future-proofing for RTL languages)
    if (editorRef.current) {
      const isRTL = false; // None of the current languages are RTL, but keeping this for future
      editorRef.current.dir = isRTL ? 'rtl' : 'ltr';
    }

    toast.success(`Language changed to ${getLanguageName(newLanguage)}`);
  }, [document]);

  const insertTextAtCursor = useCallback((text: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();

    // Prefer browser-native rich-text insertion so active styles (bold/italic/underline)
    // apply to remapped and on-screen-keyboard input as expected.
    const insertedWithCommand = window.document.execCommand('insertText', false, text);

    if (!insertedWithCommand) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        editorRef.current.append(text);
      } else {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = window.document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    setHasUnsavedChanges(true);
    updateFormattingState();
  }, [updateFormattingState]);

  const handleFormat = useCallback((command: string) => {
    if (command.startsWith('fontSize:')) {
      const size = command.split(':')[1];
      window.document.execCommand('fontSize', false, size);
      setHasUnsavedChanges(true);
    } else if (command.startsWith('lineHeight:')) {
      const lineHeight = command.split(':')[1];
      
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      // Use utility function to find block element
      const blockElement = findBlockElement(selection.anchorNode, editorRef.current);
      
      if (blockElement) {
        blockElement.style.lineHeight = lineHeight;
        setHasUnsavedChanges(true);
      } else if (editorRef.current) {
        // If no block element found, create a wrapper
        const range = selection.getRangeAt(0);
        const wrapper = window.document.createElement('div');
        wrapper.style.lineHeight = lineHeight;
        range.surroundContents(wrapper);
        setHasUnsavedChanges(true);
      }
    } else {
      window.document.execCommand(command, false);
      setHasUnsavedChanges(true);
    }
    editorRef.current?.focus();
    updateFormattingState();
  }, [updateFormattingState]);

  const handleDownload = useCallback(async (format: ExportFormat) => {
    if (!document || !editorRef.current) return;
    
    const docToExport = {
      ...document,
      content: editorRef.current.innerHTML,
    };

    try {
      await exportDocument(docToExport, format);
      toast.success('Document downloaded');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  }, [document]);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0);
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelectionRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
  }, []);

  const handleImageSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(png|jpe?g)$/)) {
      toast.error('Please select a PNG or JPEG image');
      event.target.value = '';
      return;
    }

    // Validate file size
    if (file.size > UI_CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
      toast.error('Image size must be less than 5MB');
      event.target.value = '';
      return;
    }

    try {
      // Read the file as base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        const imageName = file.name.replace(/\.[^/.]+$/, '').trim();
        
        // Create an image element
        const img = window.document.createElement('img');
        img.src = base64Data;
        img.alt = imageName || 'Inserted image';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '1rem 0';
        img.style.cursor = 'pointer';
        img.contentEditable = 'false';
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', 'Resize image. Press Enter or Space to change size');
        
        const cycleImageSize = () => {
          const currentWidth = img.style.width || '100%';
          img.style.width = getNextImageSize(currentWidth, UI_CONSTANTS.IMAGE_SIZES);
          setHasUnsavedChanges(true);
        };
        
        // Add resize functionality on click
        img.addEventListener('click', (clickEvent) => {
          clickEvent.stopPropagation();
          cycleImageSize();
        });

        img.addEventListener('keydown', (keyEvent) => {
          if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
            keyEvent.preventDefault();
            keyEvent.stopPropagation();
            cycleImageSize();
          }
        });

        // Restore the selection and insert the image
        restoreSelection();
        const selection = window.getSelection();
        
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          
          // Create a wrapper div for the image
          const wrapper = window.document.createElement('div');
          wrapper.contentEditable = 'false';
          wrapper.style.margin = '1rem 0';
          wrapper.appendChild(img);
          
          range.insertNode(wrapper);
          
          // Move cursor after the image
          range.setStartAfter(wrapper);
          range.setEndAfter(wrapper);
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Create a new paragraph after the image for continued typing
          const newPara = window.document.createElement('div');
          newPara.innerHTML = '<br>';
          wrapper.parentNode?.insertBefore(newPara, wrapper.nextSibling);
          
          // Move cursor to the new paragraph
          range.setStart(newPara, 0);
          range.setEnd(newPara, 0);
          selection.removeAllRanges();
          selection.addRange(range);
        } else if (editorRef.current) {
          // If no selection, append to the end
          const wrapper = window.document.createElement('div');
          wrapper.contentEditable = 'false';
          wrapper.style.margin = '1rem 0';
          wrapper.appendChild(img);
          editorRef.current.appendChild(wrapper);
        }
        
        setHasUnsavedChanges(true);
        editorRef.current?.focus();
        toast.success('Image inserted successfully');
      };
      
      reader.onerror = () => {
        toast.error('Failed to read image file');
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error inserting image:', error);
      toast.error('Failed to insert image');
    }

    // Reset file input
    event.target.value = '';
  }, [restoreSelection]);

  const handleInsertImage = useCallback(() => {
    // Save the current cursor position
    saveSelection();
    // Trigger the file input
    imageInputRef.current?.click();
  }, [saveSelection]);

  const toggleKeyboardVisibility = useCallback(() => {
    setIsKeyboardVisible((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const isImageWrapper = (element: Element | null): element is HTMLElement =>
      element instanceof HTMLElement &&
      element.getAttribute('contenteditable') === 'false' &&
      element.querySelector('img') !== null;

    const hasMeaningfulContent = (fragment: DocumentFragment) => {
      if (fragment.querySelector('img')) return true;
      const text = fragment.textContent?.replace(/\u200B/g, '').trim() ?? '';
      return text.length > 0;
    };

    const shortcutAction = getEditorShortcutAction(event);
    if (shortcutAction === 'toggleKeyboard') {
      // Let the global handler perform the toggle exactly once.
      // We still prevent default to avoid browser/host shortcut side effects.
      event.preventDefault();
      return;
    }

    if (shortcutAction && shortcutAction !== 'save') {
      event.preventDefault();
      handleFormat(shortcutAction);
      return;
    }

    if (event.key === 'Backspace' && editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const editor = editorRef.current;
        let wrapperToDelete: HTMLElement | null = null;

        // Case 1: caret is directly in the editor root after an image wrapper.
        if (range.startContainer === editor && range.startOffset > 0) {
          const previousNode = editor.childNodes[range.startOffset - 1];
          if (previousNode instanceof HTMLElement && isImageWrapper(previousNode)) {
            wrapperToDelete = previousNode;
          }
        }

        // Case 2: caret is at the beginning of a block that follows an image wrapper.
        if (!wrapperToDelete) {
          const blockElement = findBlockElement(range.startContainer, editor);
          if (blockElement) {
            const beforeRange = range.cloneRange();
            beforeRange.selectNodeContents(blockElement);
            beforeRange.setEnd(range.startContainer, range.startOffset);
            const caretAtStartOfBlock = !hasMeaningfulContent(beforeRange.cloneContents());

            if (caretAtStartOfBlock) {
              const previousElement = blockElement.previousElementSibling;
              if (isImageWrapper(previousElement)) {
                wrapperToDelete = previousElement;
              }
            }
          }
        }

        if (wrapperToDelete) {
          event.preventDefault();
          wrapperToDelete.remove();
          setHasUnsavedChanges(true);
          updateFormattingState();
          return;
        }
      }
    }

    if (isKeyboardVisible && !event.ctrlKey && !event.metaKey && !event.altKey && !event.nativeEvent.isComposing) {
      const remappedCharacter = getRemappedCharacter({
        language: activeLanguage,
        key: event.key,
        shiftKey: event.shiftKey,
        capsLock: event.getModifierState('CapsLock'),
      });

      if (remappedCharacter && remappedCharacter !== event.key) {
        event.preventDefault();
        insertTextAtCursor(remappedCharacter);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      // Let the default behavior happen, but ensure proper paragraph structure
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      // Find the current block element to copy its line-height
      const blockElement = findBlockElement(selection.anchorNode, editorRef.current);
      const currentLineHeight = blockElement ? getLineHeight(blockElement) : '1.15';
      
      // Use setTimeout to apply line height to the new paragraph after it's created
      setTimeout(() => {
        const newSelection = window.getSelection();
        if (!newSelection || newSelection.rangeCount === 0) return;
        
        const newBlock = findBlockElement(newSelection.anchorNode, editorRef.current);
        if (newBlock) {
          newBlock.style.lineHeight = currentLineHeight;
        }
      }, 0);
    }
  }, [activeLanguage, handleFormat, insertTextAtCursor, isKeyboardVisible]);

  const handleGlobalKeyDown = useCallback((event: KeyboardEvent) => {
    const shortcutAction = getEditorShortcutAction(event);
    if (shortcutAction === 'save') {
      event.preventDefault();
      void handleSave();
      return;
    }
    if (shortcutAction === 'toggleKeyboard') {
      event.preventDefault();
      toggleKeyboardVisibility();
    }
  }, [handleSave, toggleKeyboardVisibility]);

  // Auto-save hook
  useAutoSave(hasUnsavedChanges, handleSave);

  // Listen globally so Ctrl/Cmd + S works anywhere on the editor page.
  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleGlobalKeyDown]);

  const handleSelectionChange = useCallback(() => {
    updateFormattingState();
  }, [updateFormattingState]);

  // Current supported languages are LTR.
  const languageDir: 'ltr' | 'rtl' = 'ltr';

  // Load document on mount
  useEffect(() => {
    async function loadDocument() {
      if (documentId) {
        const doc = await getDocument(documentId);
        if (doc) {
          setDocument(doc);
        }
      } else {
        // Create new document
        const newDoc: Document = {
          id: generateId(),
          title: EDITOR_CONFIG.DEFAULT_TITLE,
          content: '',
          language: EDITOR_CONFIG.DEFAULT_LANGUAGE,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setDocument(newDoc);
      }
    }
    loadDocument();
  }, [documentId]);

  // Set editor content when document is loaded and ref is available
  useEffect(() => {
    if (document && editorRef.current) {
      editorRef.current.innerHTML = document.content;
    }
  }, [document?.id]); // Only run when document changes

  if (!document) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-white">
      <EditorToolbar
        language={document.language}
        onLanguageChange={handleLanguageChange}
        onSave={() => handleSave()}
        onDownload={handleDownload}
        onBack={onBack}
        onFormat={handleFormat}
        formattingState={formattingState}
        isSaving={isSaving}
        title={document.title}
        onTitleChange={handleTitleChange}
        hasUnsavedChanges={hasUnsavedChanges}
        onInsertImage={handleInsertImage}
      />

      {/* Hidden file input for image insertion */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleImageSelect}
        className="sr-only"
        aria-label="Select image to insert"
      />

      {/* Editor content and keyboard layout */}
      <div className="flex-1 overflow-auto bg-gray-100 px-2 sm:px-4 py-4 sm:py-6">
        <div className="mx-auto w-full max-w-[1600px] grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:items-start">
          <div className="min-w-0">
            <div className="max-w-4xl xl:max-w-none mx-auto w-full flex flex-col">
              <div
                ref={editorRef}
                contentEditable
                className="min-h-[calc(100vh-190px)] min-h-[calc(100dvh-190px)] bg-white p-4 sm:p-8 md:p-12 shadow-lg rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                style={{
                  direction: languageDir,
                  lineHeight: '1.15',
                }}
                dir={languageDir}
                onInput={handleContentChange}
                onSelect={handleSelectionChange}
                onKeyDown={handleKeyDown}
                role="textbox"
                aria-multiline="true"
                aria-label={`Document editor for ${document.title || 'Untitled Document'}`}
                lang={document.language}
              />
            </div>
          </div>

          <div className="lg:sticky lg:top-4">
            <LanguageKeyboard
              className="w-full"
              language={document.language}
              isVisible={isKeyboardVisible}
              onToggleVisibility={toggleKeyboardVisibility}
              onInsertCharacter={insertTextAtCursor}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
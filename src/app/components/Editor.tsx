import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EditorToolbar } from './EditorToolbar';
import { LanguageKeyboard } from './LanguageKeyboard';
import type { Document } from '../models/document';
import { generateDocumentId } from '../models/document';
import { getAllFolders, getDocument, saveDocument } from '../data/document-repository';
import { exportDocument, type ExportFormat } from '../utils/export';
import { getLanguageName, isChineseLanguage, isRTLLanguage, type Language } from '../utils/languages';
import { getDefaultFontFamilyForLanguage, resolveDocumentFontFamily } from '../utils/language-fonts';
import { EDITOR_CONFIG, UI_CONSTANTS } from '../utils/constants';
import {
  findBlockElement,
  findBlockElementsIntersectingRange,
  getLineHeight,
  getNextImageSize
} from '../utils/dom';
import { ensureSelectionInEditor } from '../utils/editor-selection';
import type { KeyboardLayoutOverrides } from '../utils/keyboardLayouts';
import { getRemappedCharacter } from '../utils/keyboardLayouts';
import {
  chineseLanguageToScript,
  getChineseCandidates,
  normalizePinyin,
  resolveChinesePinyinBufferEffect,
  resolveChinesePinyinKeyAction,
  type ChineseCandidate
} from '../utils/chinesePinyin';
import { getEditorShortcutAction } from '../utils/keyboardShortcuts';
import { useFormattingState } from '../hooks/useFormattingState';
import { useAutoSave } from '../hooks/useAutoSave';
import { getUserSettings, languageToLocale, localeToLanguage, updateUserSettings } from '../data/settings-repository';
import type { UserSettings } from '../api/contracts';
import { DOCUMENT_PAYLOAD_TOO_LARGE_MESSAGE, isPayloadTooLargeError } from '../api/client';
import { toast } from 'sonner';
import { NEW_DOCUMENT_FOLDER_ID_STORAGE_KEY } from '../data/storage-keys';

async function loadUserSettingsForEditor(): Promise<UserSettings | null> {
  try {
    return await getUserSettings();
  } catch (error) {
    console.error('Error loading user settings:', error);
    return null;
  }
}

interface EditorProps {
  documentId: string | null;
  /** When opening from the document list, avoids a redundant fetch (list payload already includes body). */
  initialDocument?: Document;
  onBack: () => void;
}

export function Editor({ documentId, initialDocument, onBack }: EditorProps) {
  // State hooks
  const [document, setDocument] = useState<Document | null>(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDocumentReady, setIsDocumentReady] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(true);
  const [keyboardLayoutOverrides, setKeyboardLayoutOverrides] = useState<KeyboardLayoutOverrides>({});
  const [pinyinBuffer, setPinyinBuffer] = useState('');
  const keyboardLayoutSaveRequestRef = useRef(0);
  
  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const documentRef = useRef<Document | null>(null);
  const isSaveRunningRef = useRef(false);
  const saveRequestedWhileRunningRef = useRef(false);
  const isMountedRef = useRef(true);
  const latestLoadRequestRef = useRef(0);
  const initialDocumentRef = useRef<Document | undefined>(undefined);

  // Custom hooks
  const { formattingState, updateFormattingState } = useFormattingState();
  const activeLanguage = document?.language ?? EDITOR_CONFIG.DEFAULT_LANGUAGE;
  const activeChineseScript = isChineseLanguage(activeLanguage) ? chineseLanguageToScript(activeLanguage) : null;
  const pinyinCandidates = useMemo(
    () =>
      activeChineseScript
        ? getChineseCandidates({ pinyin: pinyinBuffer, script: activeChineseScript })
        : [],
    [activeChineseScript, pinyinBuffer]
  );

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.startContainer) && editorRef.current.contains(range.endContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelectionRef.current) {
      const selection = window.getSelection();
      if (selection && editorRef.current) {
        const range = savedSelectionRef.current;
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        const editor = editorRef.current;
        const isRangeInsideEditor =
          editor.contains(startContainer) && editor.contains(endContainer);

        if (!isRangeInsideEditor) {
          return;
        }

        try {
          selection.removeAllRanges();
          selection.addRange(range);
        } catch {
          // Ignore invalid/stale ranges and fall back to current selection.
        }
      }
    }
  }, []);

  // Callbacks
  const handleSave = useCallback(async () => {
    if (isSaveRunningRef.current) {
      saveRequestedWhileRunningRef.current = true;
      return;
    }

    isSaveRunningRef.current = true;
    setIsSaving(true);

    try {
      do {
        saveRequestedWhileRunningRef.current = false;

        const activeDocument = documentRef.current;
        if (!activeDocument || !editorRef.current) {
          break;
        }

        const updatedDoc = {
          ...activeDocument,
          content: editorRef.current.innerHTML,
          updatedAt: Date.now(),
        };

        const persistedDocument = await saveDocument(updatedDoc);
        documentRef.current = persistedDocument;
        setDocument(persistedDocument);
        setHasUnsavedChanges(false);
      } while (saveRequestedWhileRunningRef.current);
    } catch (error) {
      console.error('Error saving document:', error);
      if (isPayloadTooLargeError(error)) {
        toast.error(DOCUMENT_PAYLOAD_TOO_LARGE_MESSAGE);
      } else {
        toast.error('Failed to save document');
      }
    } finally {
      isSaveRunningRef.current = false;
      setIsSaving(false);
    }
  }, []);

  const handleContentChange = useCallback(() => {
    setHasUnsavedChanges(true);
    saveSelection();
    updateFormattingState();
  }, [saveSelection, updateFormattingState]);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (!document) return;
    setDocument({ ...document, title: newTitle });
    setHasUnsavedChanges(true);
  }, [document]);

  const handleLanguageChange = useCallback((newLanguage: Language) => {
    if (!document) return;

    const nextFontFamily = resolveDocumentFontFamily(newLanguage, document.fontFamily);
    setDocument({ ...document, language: newLanguage, fontFamily: nextFontFamily });
    setHasUnsavedChanges(true);
    
    if (editorRef.current) {
      editorRef.current.dir = isRTLLanguage(newLanguage) ? 'rtl' : 'ltr';
      editorRef.current.style.fontFamily = nextFontFamily;
    }

    toast.success(`Language changed to ${getLanguageName(newLanguage)}`);
    void updateUserSettings({ lastUsedLocale: languageToLocale(newLanguage) }).catch((error) => {
      console.error('Error saving language preference:', error);
    });
  }, [document]);

  const handleFontFamilyChange = useCallback((nextFontFamily: string) => {
    const resolvedFontFamily = resolveDocumentFontFamily(
      documentRef.current?.language ?? EDITOR_CONFIG.DEFAULT_LANGUAGE,
      nextFontFamily
    );

    if (editorRef.current) {
      const editorElement = editorRef.current;
      restoreSelection();
      editorElement.focus();

      const selection = ensureSelectionInEditor(editorElement);
      if (!selection) {
        return;
      }

      // Compute before execCommand mutates the DOM or moves the caret.
      let selectionCoversEntireDocument = false;
      if (selection.rangeCount > 0 && editorElement) {
        const selectedRange = selection.getRangeAt(0).cloneRange();
        const editorRange = window.document.createRange();
        editorRange.selectNodeContents(editorElement);
        selectionCoversEntireDocument =
          selectedRange.compareBoundaryPoints(Range.START_TO_START, editorRange) === 0 &&
          selectedRange.compareBoundaryPoints(Range.END_TO_END, editorRange) === 0;
      }

      // Ask the browser to keep formatting as CSS spans when possible.
      window.document.execCommand('styleWithCSS', false, 'true');
      const applied = window.document.execCommand('fontName', false, resolvedFontFamily);

      // Fallback for environments where execCommand(fontName) fails.
      if (!applied) {
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          const wrapper = window.document.createElement('span');
          wrapper.style.fontFamily = resolvedFontFamily;
          wrapper.appendChild(range.extractContents());
          range.insertNode(wrapper);
          range.setStartAfter(wrapper);
          range.setEndAfter(wrapper);
          selection.removeAllRanges();
          selection.addRange(range);
          saveSelection();
        }
      }

      if (!applied && (!selection || selection.rangeCount === 0 || selection.isCollapsed)) {
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const marker = window.document.createElement('span');
          marker.style.fontFamily = resolvedFontFamily;
          marker.appendChild(window.document.createTextNode('\u200B'));
          range.insertNode(marker);
          range.setStart(marker.firstChild as Text, 1);
          range.setEnd(marker.firstChild as Text, 1);
          selection.removeAllRanges();
          selection.addRange(range);
          saveSelection();
        }
      }

      // Keep toolbar / persisted default in sync. Only change the editor root font when the
      // whole document is targeted (like changing default in Word); partial selections use
      // inline markup only so unstyled paragraphs keep the previous default.
      if (selectionCoversEntireDocument) {
        editorElement.style.fontFamily = resolvedFontFamily;
      }

      setDocument((current) => {
        if (!current) {
          return current;
        }
        if (!selectionCoversEntireDocument && current.fontFamily === resolvedFontFamily) {
          return current;
        }
        return {
          ...current,
          fontFamily: resolvedFontFamily
        };
      });
    }

    setHasUnsavedChanges(true);
    updateFormattingState();
  }, [restoreSelection, saveSelection, updateFormattingState]);

  const insertTextAtCursor = useCallback((text: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();
    restoreSelection();

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
    saveSelection();
    updateFormattingState();
  }, [restoreSelection, saveSelection, updateFormattingState]);

  const updatePinyinBuffer = useCallback((next: string) => {
    setPinyinBuffer(normalizePinyin(next));
  }, []);

  const clearPinyinBuffer = useCallback(() => {
    setPinyinBuffer('');
  }, []);

  const commitChineseCandidate = useCallback((candidate: ChineseCandidate) => {
    insertTextAtCursor(candidate.text);
    setPinyinBuffer('');
  }, [insertTextAtCursor]);

  const handleFormat = useCallback((command: string) => {
    if (command.startsWith('fontSize:')) {
      const size = command.split(':')[1];
      window.document.execCommand('fontSize', false, size);
      setHasUnsavedChanges(true);
    } else if (command.startsWith('lineHeight:')) {
      const lineHeight = command.split(':')[1];

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !editorRef.current) return;

      const range = selection.getRangeAt(0);
      const blocks = findBlockElementsIntersectingRange(range, editorRef.current);

      if (blocks.length > 0) {
        for (const block of blocks) {
          block.style.lineHeight = lineHeight;
        }
        setHasUnsavedChanges(true);
      } else {
        const wrapper = window.document.createElement('div');
        wrapper.style.lineHeight = lineHeight;
        try {
          range.surroundContents(wrapper);
          setHasUnsavedChanges(true);
        } catch {
          toast.warning(
            'Line spacing could not be applied to this selection. Try a simpler selection or adjust spacing per paragraph.'
          );
        }
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
        if (!isMountedRef.current) {
          return;
        }

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

        // Restore the selection and insert the image (never insert outside the editor surface).
        editorRef.current?.focus();
        restoreSelection();
        if (editorRef.current) {
          ensureSelectionInEditor(editorRef.current);
        }
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
        if (!isMountedRef.current) {
          return;
        }
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

  const handleInsertImagePointerDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    // Keep focus/selection in the contenteditable; saving on "click" runs after focus moved to the toolbar.
    event.preventDefault();
    saveSelection();
  }, [saveSelection]);

  const handleInsertImageClick = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const toggleKeyboardVisibility = useCallback(() => {
    setIsKeyboardVisible((prev) => {
      const next = !prev;
      void updateUserSettings({ keyboardVisible: next }).catch((error) => {
        console.error('Error saving keyboard visibility setting:', error);
      });
      return next;
    });
  }, []);

  const persistKeyboardLayoutOverrides = useCallback((next: KeyboardLayoutOverrides) => {
    setKeyboardLayoutOverrides((previous) => {
      const rollback = previous;
      const requestId = ++keyboardLayoutSaveRequestRef.current;
      void updateUserSettings({ keyboardLayoutOverrides: next }).catch((error) => {
        console.error('Error saving keyboard layout overrides:', error);
        if (keyboardLayoutSaveRequestRef.current === requestId) {
          setKeyboardLayoutOverrides(rollback);
          toast.error('Failed to save keyboard mappings. Your previous mappings were restored.');
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    setPinyinBuffer((prev) => {
      if (!isChineseLanguage(activeLanguage) || !isKeyboardVisible) {
        return prev ? '' : prev;
      }
      return prev;
    });
  }, [activeLanguage, isKeyboardVisible]);

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

    if (isKeyboardVisible && isChineseLanguage(activeLanguage)) {
      const pinyinAction = resolveChinesePinyinKeyAction({
        key: event.key,
        buffer: pinyinBuffer,
        candidates: pinyinCandidates,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        isComposing: event.nativeEvent.isComposing,
        captureTextInput: true
      });
      const bufferEffect = resolveChinesePinyinBufferEffect(pinyinAction, pinyinBuffer);

      if (bufferEffect.type === 'setBuffer') {
        event.preventDefault();
        setPinyinBuffer(bufferEffect.value);
        return;
      }

      if (bufferEffect.type === 'clear') {
        event.preventDefault();
        clearPinyinBuffer();
        return;
      }

      if (bufferEffect.type === 'commit') {
        event.preventDefault();
        event.stopPropagation();
        commitChineseCandidate(bufferEffect.candidate);
        return;
      }
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
        code: event.code,
        shiftKey: event.shiftKey,
        capsLock: event.getModifierState('CapsLock'),
        keyboardLayoutOverrides,
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
  }, [
    activeLanguage,
    clearPinyinBuffer,
    commitChineseCandidate,
    handleFormat,
    insertTextAtCursor,
    isKeyboardVisible,
    keyboardLayoutOverrides,
    pinyinBuffer,
    pinyinCandidates
  ]);

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
  useAutoSave(hasUnsavedChanges && isDocumentReady, handleSave);

  // Listen globally so Ctrl/Cmd + S works anywhere on the editor page.
  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleGlobalKeyDown]);

  const handleSelectionChange = useCallback(() => {
    saveSelection();
    updateFormattingState();
  }, [saveSelection, updateFormattingState]);

  const languageDir: 'ltr' | 'rtl' =
    document && isRTLLanguage(document.language) ? 'rtl' : 'ltr';

  // Load document on mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (documentId && initialDocument?.id === documentId) {
      initialDocumentRef.current = initialDocument;
    } else {
      initialDocumentRef.current = undefined;
    }
  }, [documentId, initialDocument]);

  useEffect(() => {
    const requestId = ++latestLoadRequestRef.current;
    let cancelled = false;
    setLoadErrorMessage(null);
    setDocument(null);
    setIsDocumentReady(false);
    setHasUnsavedChanges(false);
    setIsSaving(false);
    saveRequestedWhileRunningRef.current = false;
    isSaveRunningRef.current = false;

    const applyIfCurrent = (apply: () => void) => {
      if (cancelled || latestLoadRequestRef.current !== requestId || !isMountedRef.current) {
        return;
      }
      apply();
    };

    async function loadDocument() {
      if (documentId) {
        const settingsPromise = loadUserSettingsForEditor();

        const initialFromList =
          initialDocumentRef.current && initialDocumentRef.current.id === documentId
            ? initialDocumentRef.current
            : undefined;
        const docPromise = initialFromList
          ? Promise.resolve(initialFromList)
          : getDocument(documentId);

        try {
          const [settings, doc] = await Promise.all([settingsPromise, docPromise]);

          applyIfCurrent(() => {
            if (settings) {
              setIsKeyboardVisible(settings.keyboardVisible);
              setKeyboardLayoutOverrides(settings.keyboardLayoutOverrides ?? {});
            }
          });

          if (!doc) {
            applyIfCurrent(() => {
              setLoadErrorMessage('This document no longer exists or you no longer have access to it.');
            });
            return;
          }
          applyIfCurrent(() => {
            setDocument(doc);
            setIsDocumentReady(true);
          });
        } catch (error) {
          console.error('Error loading document:', error);
          applyIfCurrent(() => {
            setLoadErrorMessage('Failed to load this document. Please try again.');
          });
        }
        return;
      }

      let lastUsedLocale: string | null = null;
      const settings = await loadUserSettingsForEditor();
      if (settings) {
        applyIfCurrent(() => {
          setIsKeyboardVisible(settings.keyboardVisible);
          setKeyboardLayoutOverrides(settings.keyboardLayoutOverrides ?? {});
        });
        lastUsedLocale = settings.lastUsedLocale;
      }

      let preferredLanguage: Language = EDITOR_CONFIG.DEFAULT_LANGUAGE;
      if (lastUsedLocale) {
        preferredLanguage = localeToLanguage(lastUsedLocale);
      }

      // Create new document
      let initialFolderId = localStorage.getItem(NEW_DOCUMENT_FOLDER_ID_STORAGE_KEY);
      if (initialFolderId) {
        try {
          const folders = await getAllFolders();
          const folderExists = folders.some((folder) => folder.id === initialFolderId);
          if (!folderExists) {
            initialFolderId = null;
            localStorage.removeItem(NEW_DOCUMENT_FOLDER_ID_STORAGE_KEY);
          }
        } catch {
          initialFolderId = null;
        }
      }
      const newDoc: Document = {
        id: generateDocumentId(),
        title: EDITOR_CONFIG.DEFAULT_TITLE,
        content: '',
        language: preferredLanguage,
        folderId: initialFolderId,
        fontFamily: getDefaultFontFamilyForLanguage(preferredLanguage),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      applyIfCurrent(() => {
        setDocument(newDoc);
        setIsDocumentReady(true);
      });

    }
    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [documentId, initialDocument?.id]);

  // Keep the editable DOM synchronized with loaded/saved document content.
  // Guard against unnecessary resets so we do not disturb caret/selection.
  useEffect(() => {
    if (document && editorRef.current) {
      if (editorRef.current.innerHTML !== document.content) {
        editorRef.current.innerHTML = document.content;
      }
    }
  }, [document?.id, document?.content]);

  // Default font for the editor surface (new text / unstyled blocks). Do not tie this to
  // document.fontFamily on every toolbar change — that re-styled the whole document and
  // fought partial execCommand(fontName) results. Language changes set root font explicitly;
  // full-document font picks set it inside handleFontFamilyChange.
  useEffect(() => {
    if (document && editorRef.current) {
      editorRef.current.style.fontFamily = document.fontFamily;
    }
  }, [document?.id]);

  useEffect(() => {
    if (document && editorRef.current) {
      editorRef.current.dir = isRTLLanguage(document.language) ? 'rtl' : 'ltr';
    }
  }, [document?.id, document?.language]);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  if (!document) {
    if (loadErrorMessage) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 px-4 text-center">
          <div className="text-gray-700" role="alert" aria-live="assertive">
            {loadErrorMessage}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to documents
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500" role="status" aria-live="polite">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-white">
      <EditorToolbar
        language={document.language}
        fontFamily={document.fontFamily}
        onFontFamilyChange={handleFontFamilyChange}
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
        onInsertImagePointerDown={handleInsertImagePointerDown}
        onInsertImage={handleInsertImageClick}
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
              keyboardLayoutOverrides={keyboardLayoutOverrides}
              onKeyboardLayoutOverridesChange={persistKeyboardLayoutOverrides}
              pinyinBuffer={pinyinBuffer}
              pinyinCandidates={pinyinCandidates}
              onPinyinBufferChange={updatePinyinBuffer}
              onPinyinCandidateSelect={commitChineseCandidate}
              onPinyinClear={clearPinyinBuffer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
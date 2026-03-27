import { useCallback, useEffect, useRef } from "react";
import type { DragEvent } from "react";

const TRANSPARENT_DRAG_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

/**
 * Floating preview while dragging a document card; keeps drag logic out of DocumentList.
 */
export function useDocumentDragPreview(
  setDraggingDocumentId: (id: string | null) => void,
  setDropTargetFolderId: (id: string | null) => void
) {
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 20, y: 20 });
  const dragPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragAnimationFrameRef = useRef<number | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  const scheduleDragPreviewPositionUpdate = useCallback((): void => {
    if (dragAnimationFrameRef.current !== null) {
      return;
    }
    dragAnimationFrameRef.current = requestAnimationFrame(() => {
      dragAnimationFrameRef.current = null;
      const preview = dragPreviewRef.current;
      if (!preview) {
        return;
      }

      const x = Math.max(8, dragPointerRef.current.x - dragOffsetRef.current.x);
      const y = Math.max(8, dragPointerRef.current.y - dragOffsetRef.current.y);
      preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (dragPreviewRef.current) {
        dragPreviewRef.current.remove();
        dragPreviewRef.current = null;
      }
      if (dragAnimationFrameRef.current !== null) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }
    };
  }, []);

  const updatePointerFromDragEvent = useCallback(
    (event: DragEvent<Element>): void => {
      if (event.clientX > 0 && event.clientY > 0) {
        dragPointerRef.current = { x: event.clientX, y: event.clientY };
        scheduleDragPreviewPositionUpdate();
      }
    },
    [scheduleDragPreviewPositionUpdate]
  );

  const onDragStartDocument = useCallback(
    (documentId: string, event: DragEvent<HTMLDivElement>): void => {
      draggingIdRef.current = documentId;
      setDraggingDocumentId(documentId);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", documentId);
      event.dataTransfer.setData("application/x-glossadocs-document-id", documentId);

      const sourceCard = event.currentTarget;
      const sourceRect = sourceCard.getBoundingClientRect();
      dragOffsetRef.current = {
        x: event.clientX - sourceRect.left,
        y: event.clientY - sourceRect.top
      };

      const preview = sourceCard.cloneNode(true) as HTMLDivElement;
      preview.style.position = "fixed";
      preview.style.top = "0";
      preview.style.left = "0";
      preview.style.width = `${sourceCard.offsetWidth}px`;
      preview.style.opacity = "1";
      preview.style.transform = "translate3d(0, 0, 0)";
      preview.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.22)";
      preview.style.pointerEvents = "none";
      preview.style.borderRadius = "12px";
      preview.style.zIndex = "9999";
      preview.style.willChange = "transform";
      preview.style.transition = "none";
      preview.setAttribute("aria-hidden", "true");
      document.body.appendChild(preview);
      dragPreviewRef.current = preview;
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
      scheduleDragPreviewPositionUpdate();

      const transparentDragImage = new Image();
      transparentDragImage.src = TRANSPARENT_DRAG_IMAGE;
      event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
    },
    [scheduleDragPreviewPositionUpdate, setDraggingDocumentId]
  );

  const onDragDocument = useCallback(
    (documentId: string, event: DragEvent<HTMLDivElement>): void => {
      if (draggingIdRef.current !== documentId) {
        return;
      }
      if (!dragPreviewRef.current) {
        return;
      }
      if (event.clientX <= 0 && event.clientY <= 0) {
        return;
      }
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
      scheduleDragPreviewPositionUpdate();
    },
    [scheduleDragPreviewPositionUpdate]
  );

  const onDragEndDocument = useCallback((): void => {
    draggingIdRef.current = null;
    setDraggingDocumentId(null);
    setDropTargetFolderId(null);
    if (dragAnimationFrameRef.current !== null) {
      cancelAnimationFrame(dragAnimationFrameRef.current);
      dragAnimationFrameRef.current = null;
    }
    if (dragPreviewRef.current) {
      dragPreviewRef.current.remove();
      dragPreviewRef.current = null;
    }
  }, [setDraggingDocumentId, setDropTargetFolderId]);

  return {
    onDragStartDocument,
    onDragDocument,
    onDragEndDocument,
    updatePointerFromDragEvent
  };
}

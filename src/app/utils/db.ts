// IndexedDB utilities for GlossaDocs
import type { Document, Folder } from "../models/document";
import { generateDocumentId } from "../models/document";
import { resolveDocumentFontFamily } from "./language-fonts";

const DB_NAME = 'GlossaDocs';
const DOCUMENT_STORE_NAME = 'documents';
const FOLDER_STORE_NAME = 'folders';
const DB_VERSION = 3;

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DOCUMENT_STORE_NAME)) {
        const objectStore = db.createObjectStore(DOCUMENT_STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(FOLDER_STORE_NAME)) {
        const folderStore = db.createObjectStore(FOLDER_STORE_NAME, { keyPath: 'id' });
        folderStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        folderStore.createIndex('parentFolderId', 'parentFolderId', { unique: false });
      }

      // Ensure legacy documents gain new persisted fields.
      if (event.oldVersion < 3 && db.objectStoreNames.contains(DOCUMENT_STORE_NAME)) {
        const tx = (event.target as IDBOpenDBRequest).transaction;
        if (tx) {
          const docsStore = tx.objectStore(DOCUMENT_STORE_NAME);
          const cursorRequest = docsStore.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) {
              return;
            }
            const value = cursor.value as Document & {
              folderId?: string | null;
              fontFamily?: string | null;
              language?: Document["language"];
            };
            const language = value.language ?? "en";
            const nextValue: Document = {
              ...(value as Document),
              folderId:
                Object.prototype.hasOwnProperty.call(value, 'folderId') ? (value.folderId ?? null) : null,
              fontFamily:
                Object.prototype.hasOwnProperty.call(value, 'fontFamily')
                  ? resolveDocumentFontFamily(language, value.fontFamily ?? null)
                  : resolveDocumentFontFamily(language, null)
            };
            cursor.update(nextValue);
            cursor.continue();
          };
        }
      }
    };
  });
}

/**
 * Helper function to execute an IndexedDB transaction
 */
async function executeTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], mode);
    const objectStore = transaction.objectStore(storeName);
    const request = operation(objectStore);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get all documents sorted by most recently updated
 */
export async function getAllDocuments(): Promise<Document[]> {
  const docs = await executeTransaction<Document[]>(DOCUMENT_STORE_NAME, 'readonly', (store) =>
    store.getAll()
  );
  // Sort by most recently updated
  return docs.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get a single document by ID
 */
export async function getDocument(id: string): Promise<Document | null> {
  const result = await executeTransaction<Document | undefined>(
    DOCUMENT_STORE_NAME,
    'readonly',
    (store) => store.get(id)
  );
  return result || null;
}

/**
 * Save or update a document
 */
export async function saveDocument(doc: Document): Promise<void> {
  await executeTransaction<IDBValidKey>(DOCUMENT_STORE_NAME, 'readwrite', (store) =>
    store.put(doc)
  );
}

/**
 * Delete a document by ID
 */
export async function deleteDocument(id: string): Promise<void> {
  await executeTransaction<undefined>(DOCUMENT_STORE_NAME, 'readwrite', (store) =>
    store.delete(id)
  );
}

/**
 * Get all folders sorted by most recently updated.
 */
export async function getAllFolders(): Promise<Folder[]> {
  const folders = await executeTransaction<Folder[]>(FOLDER_STORE_NAME, 'readonly', (store) =>
    store.getAll()
  );
  return folders.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Save or update a folder.
 */
export async function saveFolder(folder: Folder): Promise<void> {
  await executeTransaction<IDBValidKey>(FOLDER_STORE_NAME, 'readwrite', (store) =>
    store.put(folder)
  );
}

/**
 * Delete folder and reparent local child folders/documents to the folder's parent.
 */
export async function deleteFolder(id: string): Promise<void> {
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([FOLDER_STORE_NAME, DOCUMENT_STORE_NAME], 'readwrite');
    const folderStore = transaction.objectStore(FOLDER_STORE_NAME);
    const documentStore = transaction.objectStore(DOCUMENT_STORE_NAME);
    const getFolderRequest = folderStore.get(id);

    getFolderRequest.onerror = () => reject(getFolderRequest.error);
    getFolderRequest.onsuccess = () => {
      const folder = getFolderRequest.result as Folder | undefined;
      if (!folder) {
        resolve();
        return;
      }

      const parentFolderId = folder.parentFolderId;
      const foldersRequest = folderStore.getAll();
      const documentsRequest = documentStore.getAll();

      foldersRequest.onerror = () => reject(foldersRequest.error);
      documentsRequest.onerror = () => reject(documentsRequest.error);

      foldersRequest.onsuccess = () => {
        const folders = foldersRequest.result as Folder[];
        for (const child of folders) {
          if (child.parentFolderId === id) {
            folderStore.put({
              ...child,
              parentFolderId,
              updatedAt: Date.now()
            });
          }
        }
      };

      documentsRequest.onsuccess = () => {
        const documents = documentsRequest.result as Document[];
        for (const doc of documents) {
          if (doc.folderId === id) {
            documentStore.put({
              ...doc,
              folderId: parentFolderId,
              updatedAt: Date.now()
            });
          }
        }
        folderStore.delete(id);
      };
    };

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

/**
 * Generate a unique ID for a document
 */
export function generateId(): string {
  return generateDocumentId();
}

/**
 * Import a document from a JSON file
 */
export function importDocument(file: File): Promise<Document> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const doc = JSON.parse(e.target?.result as string) as Document;
        // Generate new ID to avoid conflicts
        doc.id = generateId();
        doc.updatedAt = Date.now();
        doc.folderId = null;
        doc.fontFamily = resolveDocumentFontFamily(doc.language, doc.fontFamily);
        resolve(doc);
      } catch (error) {
        reject(new Error('Invalid document format'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
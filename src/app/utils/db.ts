// IndexedDB utilities for GlossaDocs

export interface Document {
  id: string;
  title: string;
  content: string;
  language: 'en' | 'de' | 'ru';
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'GlossaDocs';
const STORE_NAME = 'documents';
const DB_VERSION = 1;

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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

/**
 * Helper function to execute an IndexedDB transaction
 */
async function executeTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], mode);
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = operation(objectStore);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get all documents sorted by most recently updated
 */
export async function getAllDocuments(): Promise<Document[]> {
  const docs = await executeTransaction<Document[]>('readonly', (store) => store.getAll());
  // Sort by most recently updated
  return docs.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get a single document by ID
 */
export async function getDocument(id: string): Promise<Document | null> {
  const result = await executeTransaction<Document | undefined>('readonly', (store) =>
    store.get(id)
  );
  return result || null;
}

/**
 * Save or update a document
 */
export async function saveDocument(doc: Document): Promise<void> {
  await executeTransaction<IDBValidKey>('readwrite', (store) => store.put(doc));
}

/**
 * Delete a document by ID
 */
export async function deleteDocument(id: string): Promise<void> {
  await executeTransaction<undefined>('readwrite', (store) => store.delete(id));
}

/**
 * Generate a unique ID for a document
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
        resolve(doc);
      } catch (error) {
        reject(new Error('Invalid document format'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
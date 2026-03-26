# Test specification: `document-repository.ts`

**Source:** `src/app/data/document-repository.ts`  
**Automated tests:** `src/test/integration/document-repository.test.ts`

This module is the single persistence facade for documents and folders: guest mode uses IndexedDB helpers; authenticated mode uses the HTTP API. Internal helpers normalize UUID checks, map API DTOs to app models, and read HTTP error status in a way that survives duplicate `ApiClientError` class identity in tests.

## Functions in this file

### Exported (public API)

| Function | Summary |
| -------- | ------- |
| `getAllDocuments()` | Returns all documents from local DB or `documentsApi.list()`, and tracks remote IDs when authenticated. |
| `getDocument(id)` | Loads one document locally or via `documentsApi.get(id)`; non-UUID and 404 become `null`. |
| `saveDocument(document)` | Saves locally, or creates/updates remotely; on update 404, recreates the document. |
| `deleteDocument(id)` | Deletes locally or calls `documentsApi.remove` for valid UUIDs. |
| `getAllFolders()` | Lists folders from local DB or `foldersApi.list()`. |
| `createFolder(name, parentFolderId)` | Creates a folder locally (generated id) or via `foldersApi.create`. |
| `updateFolder(folder)` | Updates locally or via `foldersApi.update`. |
| `deleteFolder(id)` | Deletes locally or calls `foldersApi.remove` for valid UUIDs. |

### Internal (not exported; behavior covered via the exported API and mocks)

| Function | Summary |
| -------- | ------- |
| `getApiErrorStatus(error)` | Returns HTTP status from `ApiClientError` or duck-typed `{ status: number }`; otherwise `undefined`. |
| `isUuid(value)` | Returns whether `value` matches the project’s UUID v1–v5 string pattern. |
| `toAppDocument(apiDocument)` | Maps API document JSON to `Document` (including `resolveDocumentFontFamily` and date parsing). |
| `toAppFolder(apiFolder)` | Maps API folder JSON to `Folder` with `Date.parse` on timestamps. |

---

## Test table

Each row ties an automated test to the functions it is meant to exercise. Internal helpers appear on rows where their behavior is required for the outcome.

| Purpose | Function(s) under test | Test inputs (via mocks and arguments) | Expected result if the test passes |
| ------- | ------------------------ | ---------------------------------------- | ----------------------------------- |
| First save of a document whose id is a UUID not yet known to the server should **create**, not update. | `saveDocument`, `isUuid`, `toAppDocument` | Authenticated mode; `documentsApi.create` resolves a remote document; local draft with UUID `2f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9` and fields `title`, `content`, `language`, `folderId`, `fontFamily`. | `documentsApi.update` is not called; `documentsApi.create` is called once with the payload fields (no id); returned shape matches API mapping expectations. |
| Listing documents should map API `folderId` and `fontFamily` into app documents. | `getAllDocuments`, `toAppDocument` | Authenticated mode; `documentsApi.list` returns one API document with non-null `folderId` and `fontFamily` `"Lora"`. | Result length 1; first document’s `folderId` and `fontFamily` match the API payload after font resolution. |
| Remote `getDocument` must not call the API for non-UUID ids. | `getDocument`, `isUuid` | Authenticated mode; id `"local-draft-id"`. | `null`; `documentsApi.get` never called. |
| Remote `getDocument` should return `null` on HTTP 404. | `getDocument`, `getApiErrorStatus` | Authenticated mode; `documentsApi.get` rejects with `ApiClientError` status 404; valid UUID id. | Resolved value `null`. |
| Remote `getDocument` should propagate non-404 failures. | `getDocument`, `getApiErrorStatus` | Authenticated mode; `documentsApi.get` rejects with status 500. | Promise rejects with an error matching `{ status: 500 }`. |
| Remote `getDocument` should map a successful API payload. | `getDocument`, `toAppDocument`, `isUuid` | Authenticated mode; `documentsApi.get` resolves `remoteDoc` (valid UUID, ISO dates). | Document id, title, and `createdAt` match parsed API values. |
| Remote `deleteDocument` should not call the API for non-UUID ids. | `deleteDocument`, `isUuid` | Authenticated mode; id `"not-a-uuid"`. | `documentsApi.remove` not called. |
| Remote `deleteDocument` should call remove for a valid UUID. | `deleteDocument`, `isUuid` | Authenticated mode; valid UUID; `documentsApi.remove` resolves. | `documentsApi.remove` called with that id. |
| Saving when the id is already known from a prior list should **update**. | `getAllDocuments`, `saveDocument`, `isUuid`, `toAppDocument` | Authenticated mode; `list` returns `remoteDoc`; `update` resolves an updated document; `saveDocument` with same id and updated title. | `create` not called; `update` called with id and payload fields. |
| Saving should **recreate** when update returns 404 (`ApiClientError`). | `saveDocument`, `getApiErrorStatus`, `isUuid`, `toAppDocument` | Authenticated mode; `list` seeds known id; `update` rejects 404; `create` resolves a new document id. | `create` called with payload; returned document id matches recreated id. |
| Saving should treat a **plain** `{ status: 404 }` like a real API 404 on update (status resolution without `instanceof`). | `saveDocument`, `getApiErrorStatus`, `toAppDocument` | Same as above but `update` rejects `{ status: 404 }` (not `ApiClientError`). | `create` called; returned id matches recreated document. |
| Saving should **rethrow** when update fails with a non-404 error. | `saveDocument`, `getApiErrorStatus` | Authenticated mode; `list` seeds id; `update` rejects `Error("network")`. | Promise rejects with `"network"`. |
| Guest mode should delegate document list, get, save, and delete to IndexedDB helpers. | `getAllDocuments`, `getDocument`, `saveDocument`, `deleteDocument` (guest branches) | Unauthenticated mode; mocked `getAllDocuments`, `getDocument`, `saveDocument`, `deleteDocument` on `@/app/utils/db`; one local document. | List and get match the mock; `saveDocument`/`deleteDocument` called on db with expected args. |
| Authenticated folder create and list use the API and map results. | `createFolder`, `getAllFolders`, `toAppFolder` | Authenticated mode; `foldersApi.create` and `list` return a folder DTO. | `create` called with name and parent; listed folder id matches API. |
| Authenticated `updateFolder` calls the API update endpoint. | `updateFolder`, `toAppFolder` | Authenticated mode; `foldersApi.update` resolves renamed folder DTO; `Folder` input with known id. | `update` called with id and `{ name, parentFolderId }`; returned name matches. |
| Authenticated `deleteFolder` calls remove for a valid UUID. | `deleteFolder`, `isUuid` | Authenticated mode; valid folder UUID. | `foldersApi.remove` called with that id. |
| Authenticated `deleteFolder` skips remove for non-UUID ids. | `deleteFolder`, `isUuid` | Authenticated mode; id `"not-a-uuid"`. | `foldersApi.remove` not called. |
| Guest `updateFolder` writes through `saveFolder` with a fresh `updatedAt`. | `updateFolder` (guest branch) | Unauthenticated mode; mocked `saveFolder`; folder object with id and timestamps. | `saveFolder` called once; returned `name` preserved; `updatedAt` ≥ previous. |
| Guest folder create, list, and delete use IndexedDB helpers. | `createFolder`, `getAllFolders`, `deleteFolder` (guest branches) | Unauthenticated mode; mocked `saveFolder`, `getAllFolders`, `deleteFolder`. | `saveFolder` called for create; list length 1; `deleteFolder` called with folder id. |

---

## Coverage note

Every **exported** function has at least one dedicated test row above. Internal helpers are exercised only through those tests (no separate unit file); `getApiErrorStatus` and `isUuid` are explicitly covered by the 404 / non-UUID / duck-typed 404 cases, and `toAppDocument` / `toAppFolder` by any test that asserts mapped fields or timestamps from API payloads.
